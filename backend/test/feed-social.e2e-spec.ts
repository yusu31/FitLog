import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createApp, migrateDb, resetDb, TEST_ORIGIN, withPool } from './helpers/app.js';

// 仲間の足跡（GET /feed）とスタンプ・コメント（POST/DELETE /records/{id}/reactions・/comments、DELETE /comments/{id}）の結合テスト。
// 本物の PostgreSQL・本物の better-auth。DATABASE_URL が無ければ「落ちる」（飛ばさない）。
// データの作り方（docs/testing-design.md 3-7）: グループ A（2人）・グループ B（2人）・グループなし（1人）に、それぞれ記録を入れる
const url = process.env.DATABASE_URL;

const cookieOf = (res: request.Response): string =>
  (res.headers['set-cookie'] as unknown as string[]).map((c) => c.split(';')[0]).join('; ');

const BENCH_PRESS_ID = '00000000-0000-4000-8000-000000000001';
const SQUAT_ID = '00000000-0000-4000-8000-000000000024';
// 2026-10-26（月曜）の週。日本時間 12:00〜
const WEEK = '2026-10-26';
const MON_NOON = '2026-10-26T03:00:00.000Z';
const TUE_NOON = '2026-10-27T03:00:00.000Z';
const WED_NOON = '2026-10-28T03:00:00.000Z';

describe('足跡・スタンプ・コメント（結合: 本物の PostgreSQL・better-auth）', () => {
  let app: INestApplication;

  beforeAll(async () => {
    if (!url) throw new Error('DATABASE_URL が設定されていません');
    await migrateDb(process.env.MIGRATION_DATABASE_URL ?? url);
  });

  beforeEach(async () => {
    await resetDb(url!);
    app = await createApp(url);
  });

  afterEach(async () => {
    await app?.close();
  });

  const http = () => request(app.getHttpServer());

  let userSeq = 0;
  const signUpAs = async (name: string): Promise<string> => {
    const res = await http()
      .post('/api/auth/sign-up/email')
      .set('Origin', TEST_ORIGIN)
      .send({ email: `fs${++userSeq}@example.com`, password: 'correct-horse-battery', name })
      .expect(200);
    return cookieOf(res);
  };

  const createRecord = async (cookie: string, kind: 'workout' | 'run' | 'rest' = 'workout', recordedAt = MON_NOON, id = randomUUID()): Promise<string> => {
    const body = kind === 'run' ? { id, kind, recordedAt, run: { distanceM: 5000, durationS: 1800 } } : { id, kind, recordedAt };
    await http().post('/api/records').set('Cookie', cookie).send(body).expect(201);
    return id;
  };

  const addSet = async (cookie: string, recordId: string, exerciseId: string, setNo: number, weightKg = 40, reps = 10): Promise<void> => {
    await http().post(`/api/records/${recordId}/sets`).set('Cookie', cookie).send({ id: randomUUID(), exerciseId, setNo, weightKg, reps }).expect(201);
  };

  // 作った人＋ (members - 1) 人のグループ。Cookie の配列を返す（先頭が作った人）
  const groupWith = async (members: number, label: string): Promise<string[]> => {
    const cookies = [await signUpAs(`${label}1`)];
    await http().post('/api/groups').set('Cookie', cookies[0]).send({ name: `グループ${label}` }).expect(201);
    const { token } = (await http().post('/api/groups/current/invitations').set('Cookie', cookies[0]).expect(201)).body as { token: string };
    for (let i = 1; i < members; i++) {
      const c = await signUpAs(`${label}${i + 1}`);
      await http().post(`/api/invitations/${token}/accept`).set('Cookie', c).expect(200);
      cookies.push(c);
    }
    return cookies;
  };

  // グループ A（2人）・B（2人）・なし（1人）と、それぞれの記録
  const world = async () => {
    const [a1, a2] = await groupWith(2, 'A');
    const [b1, b2] = await groupWith(2, 'B');
    const n1 = await signUpAs('なし');
    return { a1, a2, b1, b2, n1 };
  };

  type FeedBody = {
    weekStart: string;
    items: Array<{
      id: string;
      kind: string;
      recordedAt: string;
      author: { id: string; name: string };
      exerciseNames: string[];
      run?: { distanceM: number; durationS: number };
      stamps: Array<{ stampKey: string; count: number; mine: string | null }>;
      commentCount: number;
    }>;
    nextCursor: string | null;
    totals: { recordedUserCount: number; totalVolumeKg: number; totalDistanceM: number };
  };
  const getFeed = async (cookie: string, query: string = `weekStart=${WEEK}`): Promise<FeedBody> =>
    (await http().get(`/api/feed?${query}`).set('Cookie', cookie).expect(200)).body as FeedBody;

  const rows = <T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> =>
    withPool(url!, async (pool) => (await pool.query(sql, params)).rows as T[]);
  const countOf = async (table: 'reactions' | 'comments'): Promise<number> => Number((await rows<{ n: string }>(`SELECT count(*) AS n FROM ${table}`))[0].n);

  // 記録を SQL でまとめて入れる（API で数十件作ると遅いので）。recordedAt は 1 分刻みで古くなる
  const bulkInsert = (userName: string, n: number): Promise<void> =>
    withPool(url!, async (pool) => {
      await pool.query(
        `INSERT INTO records (id, user_id, kind, recorded_at, local_date)
         SELECT gen_random_uuid(), u.id, 'workout', timestamptz '2026-10-28T12:00:00Z' - (g || ' minutes')::interval, date '2026-10-28'
         FROM users u, generate_series(1, $2::int) AS g WHERE u.name = $1`,
        [userName, n],
      );
    });

  describe('GET /feed（仲間の足跡と週の合計）', () => {
    it('Cookie なしでは 401', async () => {
      await http().get(`/api/feed?weekStart=${WEEK}`).expect(401);
    });

    it.each([['weekStart なし', ''], ['実在しない日付', 'weekStart=2026-02-30'], ['形が違う', 'weekStart=2026/10/26'], ['cursor が壊れている', `weekStart=${WEEK}&cursor=xxxx`]])(
      '%s は 400 VALIDATION_ERROR',
      async (_name, query) => {
        const { a1 } = await world();
        const res = await http().get(`/api/feed?${query}`).set('Cookie', a1).expect(400);
        expect(res.body.code).toBe('VALIDATION_ERROR');
      },
    );

    it('同じグループの今週の記録が、新しい順に出る。種類・時刻・種目名・書いた人の表示名・ランの距離つき', async () => {
      const { a1, a2 } = await world();
      const bench = await createRecord(a1, 'workout', MON_NOON);
      await addSet(a1, bench, BENCH_PRESS_ID, 1);
      await addSet(a1, bench, SQUAT_ID, 1);
      await addSet(a1, bench, BENCH_PRESS_ID, 2); // 同じ種目は1つにまとまる
      const run = await createRecord(a2, 'run', TUE_NOON);
      const rest = await createRecord(a2, 'rest', WED_NOON);

      const feed = await getFeed(a1);
      expect(feed.weekStart).toBe(WEEK);
      expect(feed.items.map((i) => i.id)).toEqual([rest, run, bench]);
      expect(feed.items.map((i) => i.kind)).toEqual(['rest', 'run', 'workout']);
      expect(feed.items.map((i) => i.author.name)).toEqual(['A2', 'A2', 'A1']);
      expect(feed.items[1].run).toEqual({ distanceM: 5000, durationS: 1800 });
      expect(feed.items[0].run).toBeUndefined();
      expect(feed.items[2].exerciseNames).toEqual(['ベンチプレス', 'スクワット']);
      expect(feed.items[0].exerciseNames).toEqual([]);
      expect(feed.items[0].recordedAt).toBe(WED_NOON);
      expect(feed.nextCursor).toBeNull();
    });

    // T-GRP/3-7: 最重要。別グループの記録が1件も出ない
    it('別のグループの記録は1件も出ない（A の人の足跡に B の記録も合計も混ざらない）', async () => {
      const { a1, a2, b1, b2 } = await world();
      const a1Rec = await createRecord(a1);
      await addSet(a1, a1Rec, BENCH_PRESS_ID, 1, 40, 10);
      const a2Rec = await createRecord(a2);
      await addSet(a2, a2Rec, BENCH_PRESS_ID, 1, 20, 10);
      const b1Rec = await createRecord(b1);
      await addSet(b1, b1Rec, BENCH_PRESS_ID, 1, 100, 10);
      await createRecord(b2, 'run', TUE_NOON);
      await createRecord(b2, 'rest', WED_NOON);

      const feedA = await getFeed(a1);
      expect(feedA.items).toHaveLength(2);
      expect(feedA.items.map((i) => i.id).sort()).toEqual([a1Rec, a2Rec].sort());
      expect(feedA.totals).toEqual({ recordedUserCount: 2, totalVolumeKg: 600, totalDistanceM: 0 });

      const feedB = await getFeed(b2);
      expect(feedB.items).toHaveLength(3);
      expect(feedB.items.map((i) => i.id)).not.toContain(a1Rec);
      expect(feedB.totals).toEqual({ recordedUserCount: 2, totalVolumeKg: 1000, totalDistanceM: 5000 });
    });

    it('グループに入っていない人は、自分の記録があっても足跡は空・合計は 0（200）', async () => {
      const { a1, n1 } = await world();
      await createRecord(a1);
      const mine = await createRecord(n1);
      await addSet(n1, mine, BENCH_PRESS_ID, 1);
      const feed = await getFeed(n1);
      expect(feed.items).toEqual([]);
      expect(feed.nextCursor).toBeNull();
      expect(feed.totals).toEqual({ recordedUserCount: 0, totalVolumeKg: 0, totalDistanceM: 0 });
    });

    it('グループを出た人の記録は、出たあと仲間の足跡から消え、合計にも入らない', async () => {
      const { a1, a2 } = await world();
      const rec = await createRecord(a2);
      await addSet(a2, rec, BENCH_PRESS_ID, 1);
      expect((await getFeed(a1)).items).toHaveLength(1);

      await http().delete('/api/groups/current/members/me').set('Cookie', a2).expect(204);
      const feed = await getFeed(a1);
      expect(feed.items).toEqual([]);
      expect(feed.totals.recordedUserCount).toBe(0);
    });

    it('週の合計: 記録した人数（休みだけの人は数えない）・総重量（重量×回数）・総距離。自分が休んでも仲間の数字は減らない', async () => {
      const { a1, a2 } = await world();
      const w = await createRecord(a1, 'workout', MON_NOON);
      await addSet(a1, w, BENCH_PRESS_ID, 1, 40, 10); // 400
      await addSet(a1, w, BENCH_PRESS_ID, 2, 42.5, 8); // 340
      await createRecord(a2, 'run', TUE_NOON); // 5000m
      await createRecord(a2, 'run', WED_NOON); // 5000m

      const before = await getFeed(a1);
      expect(before.totals).toEqual({ recordedUserCount: 2, totalVolumeKg: 740, totalDistanceM: 10000 });

      // a1 が休みを記録しても、a2 が休みだけの日があっても、数字は変わらない
      await createRecord(a1, 'rest', WED_NOON);
      const after = await getFeed(a2);
      expect(after.totals).toEqual(before.totals);
      expect(after.items.map((i) => i.kind)).toContain('rest');
    });

    it('休みだけの人は「記録した人数」に入らない', async () => {
      const { a1, a2 } = await world();
      await createRecord(a1, 'rest', MON_NOON);
      await createRecord(a2, 'rest', TUE_NOON);
      const feed = await getFeed(a1);
      expect(feed.items).toHaveLength(2);
      expect(feed.totals.recordedUserCount).toBe(0);
    });

    it('週の境界: 日曜 23:59（日本時間）は今週、月曜 0:00 は次の週。weekStart が水曜でも、その日を含む週を返す', async () => {
      const { a1 } = await world();
      const sun = await createRecord(a1, 'workout', '2026-11-01T14:59:00.000Z'); // 日本時間 11/1(日) 23:59
      const mon = await createRecord(a1, 'workout', '2026-11-01T15:00:00.000Z'); // 日本時間 11/2(月) 00:00
      const prevSun = await createRecord(a1, 'workout', '2026-10-25T14:59:00.000Z'); // 日本時間 10/25(日) 23:59 → 前の週

      expect((await getFeed(a1, 'weekStart=2026-10-26')).items.map((i) => i.id)).toEqual([sun]);
      expect((await getFeed(a1, 'weekStart=2026-11-02')).items.map((i) => i.id)).toEqual([mon]);
      expect((await getFeed(a1, 'weekStart=2026-10-19')).items.map((i) => i.id)).toEqual([prevSun]);

      const wed = await getFeed(a1, 'weekStart=2026-10-28');
      expect(wed.weekStart).toBe('2026-10-26');
      expect(wed.items.map((i) => i.id)).toEqual([sun]);
    });

    // 20件目と21件目（段階的に読み込む。1回に20件）
    it('21件あるとき: 1ページ目は20件で nextCursor あり、cursor を渡すと残り1件で nextCursor は null。重複も抜けもない', async () => {
      const { a1 } = await world();
      await bulkInsert('A1', 21);

      const p1 = await getFeed(a1);
      expect(p1.items).toHaveLength(20);
      expect(p1.nextCursor).not.toBeNull();
      const p2 = await getFeed(a1, `weekStart=${WEEK}&cursor=${p1.nextCursor}`);
      expect(p2.items).toHaveLength(1);
      expect(p2.nextCursor).toBeNull();

      const all = [...p1.items, ...p2.items];
      expect(new Set(all.map((i) => i.id)).size).toBe(21);
      expect(all.map((i) => i.recordedAt)).toEqual(all.map((i) => i.recordedAt).toSorted().toReversed());
    });

    it('ちょうど20件のとき: 1ページで終わり、nextCursor は null（空のページを返さない）', async () => {
      const { a1 } = await world();
      await bulkInsert('A1', 20);
      const p1 = await getFeed(a1);
      expect(p1.items).toHaveLength(20);
      expect(p1.nextCursor).toBeNull();
    });

    it('週の合計はページに関係なく週全体（2ページ目でも同じ）', async () => {
      const { a1, a2 } = await world();
      await bulkInsert('A1', 21);
      await createRecord(a2, 'run', '2026-10-28T13:00:00.000Z');
      const p1 = await getFeed(a1);
      const p2 = await getFeed(a1, `weekStart=${WEEK}&cursor=${p1.nextCursor}`);
      expect(p1.totals).toEqual(p2.totals);
      expect(p1.totals.recordedUserCount).toBe(2);
      expect(p1.totals.totalDistanceM).toBe(5000);
    });

    it('スタンプ（付いたものだけ・件数・自分のスタンプの id）とコメント数が付く', async () => {
      const { a1, a2 } = await world();
      const rec = await createRecord(a1);
      const mineId = randomUUID();
      await http().post(`/api/records/${rec}/reactions`).set('Cookie', a2).send({ id: mineId, stampKey: 'nice' }).expect(201);
      await http().post(`/api/records/${rec}/reactions`).set('Cookie', a1).send({ id: randomUUID(), stampKey: 'nice' }).expect(201);
      await http().post(`/api/records/${rec}/reactions`).set('Cookie', a1).send({ id: randomUUID(), stampKey: 'clap' }).expect(201);
      await http().post(`/api/records/${rec}/comments`).set('Cookie', a2).send({ id: randomUUID(), body: 'ナイス！' }).expect(201);
      await http().post(`/api/records/${rec}/comments`).set('Cookie', a1).send({ id: randomUUID(), body: 'ありがとう' }).expect(201);

      const asA2 = (await getFeed(a2)).items[0];
      expect(asA2.stamps.map((s) => [s.stampKey, s.count, s.mine !== null])).toEqual([
        ['nice', 2, true],
        ['clap', 1, false],
      ]);
      expect(asA2.stamps[0].mine).toBe(mineId);
      expect(asA2.commentCount).toBe(2);
    });

    // T-LATE-08: 仲間の足跡に「遅れて記録」の札（late）が出る
    it('あとから記録した仲間の記録は late: true、いつもの記録には late が無い', async () => {
      const { a1, a2 } = await world();
      const lateId = randomUUID();
      await http().post('/api/records').set('Cookie', a2).send({ id: lateId, kind: 'workout', recordedAt: MON_NOON, late: true }).expect(201);
      const usualId = await createRecord(a2, 'workout', WED_NOON);

      const { items } = await getFeed(a1);
      const byId = new Map(items.map((i) => [i.id, i as Record<string, unknown>]));
      expect(byId.get(lateId)?.late).toBe(true);
      expect(byId.get(usualId)).not.toHaveProperty('late');
    });

    it('スタンプもコメントも無い記録は、stamps が空の配列・commentCount が 0', async () => {
      const { a1 } = await world();
      await createRecord(a1);
      const item = (await getFeed(a1)).items[0];
      expect(item.stamps).toEqual([]);
      expect(item.commentCount).toBe(0);
    });
  });

  describe('POST /records/{id}/reactions（スタンプを付ける）', () => {
    const react = (cookie: string | undefined, recordId: string, body: unknown) => {
      const r = http().post(`/api/records/${recordId}/reactions`);
      return (cookie ? r.set('Cookie', cookie) : r).send(body as object);
    };

    it('Cookie なしでは 401', async () => {
      await react(undefined, randomUUID(), { id: randomUUID(), stampKey: 'nice' }).expect(401);
    });

    it('同じグループの人の記録に付けられる（201）。自分の記録にも付けられる', async () => {
      const { a1, a2 } = await world();
      const rec = await createRecord(a1);
      const id = randomUUID();
      const res = await react(a2, rec, { id, stampKey: 'fire' }).expect(201);
      expect(res.body).toEqual({ id, recordId: rec, stampKey: 'fire' });
      await react(a1, rec, { id: randomUUID(), stampKey: 'nice' }).expect(201);
      expect(await countOf('reactions')).toBe(2);
    });

    it('T-OFF: 同じ id の再送は 200 で同じ内容。1件のまま', async () => {
      const { a1, a2 } = await world();
      const rec = await createRecord(a1);
      const id = randomUUID();
      await react(a2, rec, { id, stampKey: 'fire' }).expect(201);
      const again = await react(a2, rec, { id, stampKey: 'fire' }).expect(200);
      expect(again.body).toEqual({ id, recordId: rec, stampKey: 'fire' });
      expect(await countOf('reactions')).toBe(1);
    });

    it('T-STP-01: 同じ人が同じ記録に同じスタンプを別の id で2回 → 2回目は 200 で、付いているスタンプ（1回目の id）を返す。1件のまま', async () => {
      const { a1, a2 } = await world();
      const rec = await createRecord(a1);
      const first = randomUUID();
      await react(a2, rec, { id: first, stampKey: 'fire' }).expect(201);
      const second = await react(a2, rec, { id: randomUUID(), stampKey: 'fire' }).expect(200);
      expect(second.body.id).toBe(first);
      expect(await countOf('reactions')).toBe(1);
    });

    it('T-STP-02・03: 同じ人が別のスタンプ → 2件。別の人が同じスタンプ → 2件', async () => {
      const { a1, a2 } = await world();
      const rec = await createRecord(a1);
      await react(a2, rec, { id: randomUUID(), stampKey: 'fire' }).expect(201);
      await react(a2, rec, { id: randomUUID(), stampKey: 'clap' }).expect(201);
      await react(a1, rec, { id: randomUUID(), stampKey: 'fire' }).expect(201);
      expect(await countOf('reactions')).toBe(3);
    });

    it.each<[string, Record<string, unknown>]>([['一覧にない stampKey', { stampKey: 'like' }], ['stampKey なし', { stampKey: undefined }], ['id が UUID でない', { id: 'x', stampKey: 'nice' }]])(
      'T-STP-04: %s は 400 VALIDATION_ERROR',
      async (_name, patch) => {
        const { a1 } = await world();
        const rec = await createRecord(a1);
        const res = await react(a1, rec, { id: randomUUID(), stampKey: 'nice', ...patch }).expect(400);
        expect(res.body.code).toBe('VALIDATION_ERROR');
        expect(await countOf('reactions')).toBe(0);
      },
    );

    it('T-STP-06: 休みの記録には休み用のスタンプだけ（通常のスタンプは 409）。筋トレ・ランには通常のスタンプだけ', async () => {
      const { a1, a2 } = await world();
      const rest = await createRecord(a1, 'rest');
      const workout = await createRecord(a1, 'workout');
      const run = await createRecord(a1, 'run', TUE_NOON);

      await react(a2, rest, { id: randomUUID(), stampKey: 'rest_slow' }).expect(201);
      await react(a2, rest, { id: randomUUID(), stampKey: 'rest_again' }).expect(201);
      expect((await react(a2, rest, { id: randomUUID(), stampKey: 'nice' }).expect(409)).body.code).toBe('RECORD_KIND_MISMATCH');
      expect((await react(a2, workout, { id: randomUUID(), stampKey: 'rest_slow' }).expect(409)).body.code).toBe('RECORD_KIND_MISMATCH');
      await react(a2, run, { id: randomUUID(), stampKey: 'clap' }).expect(201);
      expect(await countOf('reactions')).toBe(3);
    });

    // 3-7: 別グループ・グループなしは 404。存在しない id と同じ応答（存在を教えない）
    it('別のグループの人・グループに入っていない人が付けると 404 RECORD_NOT_FOUND。存在しない id と同じ応答の形・文言', async () => {
      const { a1, b1, n1 } = await world();
      const rec = await createRecord(a1);

      const missing = await react(b1, randomUUID(), { id: randomUUID(), stampKey: 'nice' }).expect(404);
      const otherGroup = await react(b1, rec, { id: randomUUID(), stampKey: 'nice' }).expect(404);
      const noGroup = await react(n1, rec, { id: randomUUID(), stampKey: 'nice' }).expect(404);
      expect(otherGroup.body).toEqual(missing.body);
      expect(noGroup.body).toEqual(missing.body);
      expect(missing.body.code).toBe('RECORD_NOT_FOUND');
      expect(await countOf('reactions')).toBe(0);
    });

    it('記録の id が UUID の形でないときは 404（500 にしない）', async () => {
      const { a1 } = await world();
      await react(a1, 'not-a-uuid', { id: randomUUID(), stampKey: 'nice' }).expect(404);
    });

    it('他の人のスタンプと同じ id を送ると 404 REACTION_NOT_FOUND（中身を返さない）。1件のまま', async () => {
      const { a1, a2 } = await world();
      const rec = await createRecord(a1);
      const id = randomUUID();
      await react(a1, rec, { id, stampKey: 'nice' }).expect(201);
      const res = await react(a2, rec, { id, stampKey: 'fire' }).expect(404);
      expect(res.body.code).toBe('REACTION_NOT_FOUND');
      expect(await countOf('reactions')).toBe(1);
    });

    it('DB の最後の砦: (record_id, user_id, stamp_key) が同じ行を直接 INSERT すると一意制約で拒否される', async () => {
      const { a1 } = await world();
      const rec = await createRecord(a1);
      await react(a1, rec, { id: randomUUID(), stampKey: 'nice' }).expect(201);
      await expect(
        withPool(url!, (pool) => pool.query(`INSERT INTO reactions (id, record_id, user_id, stamp_key) SELECT gen_random_uuid(), record_id, user_id, stamp_key FROM reactions`)),
      ).rejects.toMatchObject({ code: '23505' });
    });
  });

  describe('DELETE /records/{id}/reactions/{reactionId}（スタンプを外す）', () => {
    const del = (cookie: string | undefined, recordId: string, reactionId: string) => {
      const r = http().delete(`/api/records/${recordId}/reactions/${reactionId}`);
      return cookie ? r.set('Cookie', cookie) : r;
    };
    const put = async (cookie: string, recordId: string, stampKey = 'nice'): Promise<string> => {
      const id = randomUUID();
      await http().post(`/api/records/${recordId}/reactions`).set('Cookie', cookie).send({ id, stampKey }).expect(201);
      return id;
    };

    it('Cookie なしでは 401', async () => {
      await del(undefined, randomUUID(), randomUUID()).expect(401);
    });

    it('T-STP-05: 自分のスタンプは 204（本文なし）で外れ、他のスタンプは残る', async () => {
      const { a1, a2 } = await world();
      const rec = await createRecord(a1);
      const mine = await put(a2, rec, 'nice');
      await put(a1, rec, 'nice');
      const res = await del(a2, rec, mine).expect(204);
      expect(res.text).toBe('');
      expect(await countOf('reactions')).toBe(1);
    });

    it('T-STP-05: 他の人のスタンプは 403 FORBIDDEN で、外れない', async () => {
      const { a1, a2 } = await world();
      const rec = await createRecord(a1);
      const theirs = await put(a1, rec);
      const res = await del(a2, rec, theirs).expect(403);
      expect(res.body.code).toBe('FORBIDDEN');
      expect(await countOf('reactions')).toBe(1);
    });

    it('もう一度外すと 404 REACTION_NOT_FOUND（二重削除）', async () => {
      const { a1 } = await world();
      const rec = await createRecord(a1);
      const id = await put(a1, rec);
      await del(a1, rec, id).expect(204);
      expect((await del(a1, rec, id).expect(404)).body.code).toBe('REACTION_NOT_FOUND');
    });

    it('別のグループの人・グループなしの人は、記録ごと 404 RECORD_NOT_FOUND（403 にしない）。外れない', async () => {
      const { a1, b1, n1 } = await world();
      const rec = await createRecord(a1);
      const id = await put(a1, rec);
      expect((await del(b1, rec, id).expect(404)).body.code).toBe('RECORD_NOT_FOUND');
      expect((await del(n1, rec, id).expect(404)).body.code).toBe('RECORD_NOT_FOUND');
      expect(await countOf('reactions')).toBe(1);
    });

    it('別の記録のスタンプの id を指しても 404（その記録のスタンプだけが対象）。UUID でない id も 404', async () => {
      const { a1 } = await world();
      const r1 = await createRecord(a1, 'workout', MON_NOON);
      const r2 = await createRecord(a1, 'workout', TUE_NOON);
      const id = await put(a1, r1);
      await del(a1, r2, id).expect(404);
      await del(a1, r1, 'x').expect(404);
      expect(await countOf('reactions')).toBe(1);
    });
  });

  describe('POST /records/{id}/comments（コメントを付ける）', () => {
    const comment = (cookie: string | undefined, recordId: string, body: unknown) => {
      const r = http().post(`/api/records/${recordId}/comments`);
      return (cookie ? r.set('Cookie', cookie) : r).send(body as object);
    };

    it('Cookie なしでは 401', async () => {
      await comment(undefined, randomUUID(), { id: randomUUID(), body: 'a' }).expect(401);
    });

    it('同じグループの人の記録に付けられる（201）。応答に本文・書いた人・時刻が入る', async () => {
      const { a1, a2 } = await world();
      const rec = await createRecord(a1);
      const id = randomUUID();
      const res = await comment(a2, rec, { id, body: 'ナイス！' }).expect(201);
      expect(res.body).toMatchObject({ id, recordId: rec, body: 'ナイス！', author: { name: 'A2' } });
      expect(typeof res.body.createdAt).toBe('string');
    });

    // T-CMT-01〜06 の境界。0字・1字・50字・51字（絵文字は1字）
    it.each<[string, string, number]>([
      ['T-CMT-02 1字は 201', 'a', 201],
      ['T-CMT-03 50字は 201', 'a'.repeat(50), 201],
      ['T-CMT-06 絵文字を含む50字（💪は1字）は 201', `${'あ'.repeat(49)}💪`, 201],
      ['T-CMT-01 0字（空）は 400', '', 400],
      ['T-CMT-04 51字は 400', 'a'.repeat(51), 400],
      ['T-CMT-06 絵文字を含む51字は 400', `${'あ'.repeat(50)}💪`, 400],
      ['T-CMT-07 空白だけは 400', '   ', 400],
    ])('%s', async (_name, body, status) => {
      const { a1 } = await world();
      const rec = await createRecord(a1);
      const res = await comment(a1, rec, { id: randomUUID(), body }).expect(status);
      if (status === 400) expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(await countOf('comments')).toBe(status === 201 ? 1 : 0);
      if (status === 201) expect(res.body.body).toBe(body);
    });

    it('T-CMT-08: HTML の文字はそのまま保存される（返す側で変えない）', async () => {
      const { a1 } = await world();
      const rec = await createRecord(a1);
      const body = '<script>alert(1)</script>';
      const res = await comment(a1, rec, { id: randomUUID(), body }).expect(201);
      expect(res.body.body).toBe(body);
      expect((await rows<{ body: string }>('SELECT body FROM comments'))[0].body).toBe(body);
    });

    it('T-CMT-09: 同じ id の再送は 200 で 1回目の内容。1件のまま（2回目の本文は捨てる）', async () => {
      const { a1, a2 } = await world();
      const rec = await createRecord(a1);
      const id = randomUUID();
      await comment(a2, rec, { id, body: '1回目' }).expect(201);
      const again = await comment(a2, rec, { id, body: '2回目' }).expect(200);
      expect(again.body.body).toBe('1回目');
      expect(await countOf('comments')).toBe(1);
    });

    it('T-CMT-11: 別のグループの人・グループなしの人が付けると 404。存在しない id と同じ応答。付かない', async () => {
      const { a1, b1, n1 } = await world();
      const rec = await createRecord(a1);
      const missing = await comment(b1, randomUUID(), { id: randomUUID(), body: 'a' }).expect(404);
      const otherGroup = await comment(b1, rec, { id: randomUUID(), body: 'a' }).expect(404);
      const noGroup = await comment(n1, rec, { id: randomUUID(), body: 'a' }).expect(404);
      expect(otherGroup.body).toEqual(missing.body);
      expect(noGroup.body).toEqual(missing.body);
      expect(await countOf('comments')).toBe(0);
    });

    it('他の人のコメントと同じ id を送ると 404 COMMENT_NOT_FOUND（中身を返さない）。1件のまま', async () => {
      const { a1, a2 } = await world();
      const rec = await createRecord(a1);
      const id = randomUUID();
      await comment(a1, rec, { id, body: 'ひみつ' }).expect(201);
      const res = await comment(a2, rec, { id, body: 'a' }).expect(404);
      expect(res.body.code).toBe('COMMENT_NOT_FOUND');
      expect(JSON.stringify(res.body)).not.toContain('ひみつ');
      expect(await countOf('comments')).toBe(1);
    });

    it('T-CMT-12 DB の最後の砦: API を通さず 51 字を直接 INSERT すると CHECK で拒否される（50字は通る）', async () => {
      const { a1 } = await world();
      const rec = await createRecord(a1);
      const insert = (body: string) =>
        withPool(url!, (pool) => pool.query(`INSERT INTO comments (id, record_id, user_id, body) SELECT gen_random_uuid(), $1, id, $2 FROM users LIMIT 1`, [rec, body]));
      await expect(insert('a'.repeat(51))).rejects.toMatchObject({ code: '23514' });
      await expect(insert('')).rejects.toMatchObject({ code: '23514' });
      await insert('💪'.repeat(50)); // 絵文字50個（UTF-16 では 100）も、char_length では50字
      expect(await countOf('comments')).toBe(1);
    });
  });

  describe('DELETE /comments/{id}（コメントを消す）', () => {
    const del = (cookie: string | undefined, id: string) => {
      const r = http().delete(`/api/comments/${id}`);
      return cookie ? r.set('Cookie', cookie) : r;
    };
    const put = async (cookie: string, recordId: string, body = 'ナイス！'): Promise<string> => {
      const id = randomUUID();
      await http().post(`/api/records/${recordId}/comments`).set('Cookie', cookie).send({ id, body }).expect(201);
      return id;
    };

    it('Cookie なしでは 401', async () => {
      await del(undefined, randomUUID()).expect(401);
    });

    it('T-CMT-10: 自分のコメントは 204（本文なし）で消え、他のコメントは残る', async () => {
      const { a1, a2 } = await world();
      const rec = await createRecord(a1);
      const mine = await put(a2, rec);
      await put(a1, rec);
      const res = await del(a2, mine).expect(204);
      expect(res.text).toBe('');
      expect(await countOf('comments')).toBe(1);
    });

    it('T-CMT-10: 他の人のコメントは 403 FORBIDDEN で、消えない（記録の持ち主でも他人のコメントは消せない）', async () => {
      const { a1, a2 } = await world();
      const rec = await createRecord(a1);
      const theirs = await put(a2, rec);
      const res = await del(a1, theirs).expect(403);
      expect(res.body.code).toBe('FORBIDDEN');
      expect(await countOf('comments')).toBe(1);
    });

    it('もう一度消すと 404 COMMENT_NOT_FOUND。無い id・UUID でない id も 404', async () => {
      const { a1 } = await world();
      const rec = await createRecord(a1);
      const id = await put(a1, rec);
      await del(a1, id).expect(204);
      expect((await del(a1, id).expect(404)).body.code).toBe('COMMENT_NOT_FOUND');
      await del(a1, randomUUID()).expect(404);
      await del(a1, 'x').expect(404);
    });

    it('別のグループの人・グループなしの人は 404（403 にしない。存在を教えない）。消えない', async () => {
      const { a1, b1, n1 } = await world();
      const rec = await createRecord(a1);
      const id = await put(a1, rec);
      const missing = await del(b1, randomUUID()).expect(404);
      const otherGroup = await del(b1, id).expect(404);
      const noGroup = await del(n1, id).expect(404);
      expect(otherGroup.body).toEqual(missing.body);
      expect(noGroup.body).toEqual(missing.body);
      expect(await countOf('comments')).toBe(1);
    });
  });

  describe('GET /records/{id}/comments・/reactions（記録ごとの一覧。S-21）', () => {
    const get = (cookie: string | undefined, path: string) => {
      const r = http().get(`/api${path}`);
      return cookie ? r.set('Cookie', cookie) : r;
    };
    const stamp = (cookie: string, rec: string, stampKey: string, id = randomUUID()) =>
      http().post(`/api/records/${rec}/reactions`).set('Cookie', cookie).send({ id, stampKey }).expect(201).then(() => id);
    const say = (cookie: string, rec: string, body: string, id = randomUUID()) =>
      http().post(`/api/records/${rec}/comments`).set('Cookie', cookie).send({ id, body }).expect(201).then(() => id);

    it.each(['comments', 'reactions'])('%s: Cookie なしでは 401', async (kind) => {
      await get(undefined, `/records/${randomUUID()}/${kind}`).expect(401);
    });

    it('コメントが無い記録は空の配列（200）', async () => {
      const { a1 } = await world();
      const rec = await createRecord(a1);
      expect((await get(a1, `/records/${rec}/comments`).expect(200)).body).toEqual({ items: [] });
    });

    it('スタンプが無い記録は空の配列（200）', async () => {
      const { a1 } = await world();
      const rec = await createRecord(a1);
      expect((await get(a1, `/records/${rec}/reactions`).expect(200)).body).toEqual({ items: [] });
    });

    it('コメントは古い順に、本文・書いた人・時刻つきで返る。自分のコメントも仲間のコメントも入る', async () => {
      const { a1, a2 } = await world();
      const rec = await createRecord(a1);
      const c1 = await say(a2, rec, '1つ目');
      const c2 = await say(a1, rec, '2つ目');
      const c3 = await say(a2, rec, '3つ目');
      const res = await get(a1, `/records/${rec}/comments`).expect(200);
      expect(res.body.items.map((c: { id: string }) => c.id)).toEqual([c1, c2, c3]);
      expect(res.body.items[0]).toMatchObject({ recordId: rec, body: '1つ目', author: { name: 'A2' } });
      expect(res.body.items[1].author.name).toBe('A1');
      expect(typeof res.body.items[0].createdAt).toBe('string');
    });

    it('コメントは別の記録のものが混ざらない', async () => {
      const { a1, a2 } = await world();
      const r1 = await createRecord(a1);
      const r2 = await createRecord(a1, 'workout', TUE_NOON);
      await say(a2, r1, '1の方');
      await say(a2, r2, '2の方');
      const res = await get(a1, `/records/${r1}/comments`).expect(200);
      expect(res.body.items.map((c: { body: string }) => c.body)).toEqual(['1の方']);
    });

    it('スタンプはスタンプごとの数にまとまり、スタンプの一覧の順に並ぶ。自分が付けたものだけ mine に id が入る', async () => {
      const { a1, a2 } = await world();
      const rec = await createRecord(a1);
      const mineFire = await stamp(a1, rec, 'fire');
      await stamp(a2, rec, 'fire');
      await stamp(a2, rec, 'nice');
      const res = await get(a1, `/records/${rec}/reactions`).expect(200);
      expect(res.body.items).toEqual([
        { stampKey: 'nice', count: 1, mine: null },
        { stampKey: 'fire', count: 2, mine: mineFire },
      ]);
      // 仲間から見ると、mine は逆になる
      const other = await get(a2, `/records/${rec}/reactions`).expect(200);
      expect(other.body.items.find((s: { stampKey: string }) => s.stampKey === 'nice').mine).not.toBeNull();
      expect(other.body.items.find((s: { stampKey: string }) => s.stampKey === 'fire').mine).not.toBe(mineFire);
    });

    it('外したスタンプ・消したコメントは一覧から消える', async () => {
      const { a1 } = await world();
      const rec = await createRecord(a1);
      const sid = await stamp(a1, rec, 'nice');
      const cid = await say(a1, rec, 'あ');
      await http().delete(`/api/records/${rec}/reactions/${sid}`).set('Cookie', a1).expect(204);
      await http().delete(`/api/comments/${cid}`).set('Cookie', a1).expect(204);
      expect((await get(a1, `/records/${rec}/reactions`).expect(200)).body.items).toEqual([]);
      expect((await get(a1, `/records/${rec}/comments`).expect(200)).body.items).toEqual([]);
    });

    it('休みの記録のスタンプ（休み用）も集計される', async () => {
      const { a1, a2 } = await world();
      const rec = await createRecord(a1, 'rest');
      await stamp(a2, rec, 'rest_slow');
      const res = await get(a1, `/records/${rec}/reactions`).expect(200);
      expect(res.body.items).toEqual([{ stampKey: 'rest_slow', count: 1, mine: null }]);
    });

    // 見られない記録は、無い記録と同じ 404（存在を教えない）。testing-design.md 6章の表
    it.each(['comments', 'reactions'])('%s: 別のグループの人の記録・グループに入っていない人から見た他人の記録・存在しない id・UUID でない id は、どれも同じ 404', async (kind) => {
      const { a1, b1, n1 } = await world();
      const rec = await createRecord(a1);
      await say(a1, rec, 'ひみつ');
      const missing = (await get(a1, `/records/${randomUUID()}/${kind}`).expect(404)).body;
      expect(missing.code).toBe('RECORD_NOT_FOUND');
      for (const cookie of [b1, n1]) {
        const res = await get(cookie, `/records/${rec}/${kind}`).expect(404);
        expect(res.body).toEqual(missing);
      }
      await get(a1, `/records/not-a-uuid/${kind}`).expect(404);
    });

    it('グループに入っていない人は、自分の記録なら見られる', async () => {
      const { n1 } = await world();
      const rec = await createRecord(n1);
      await say(n1, rec, 'ひとり');
      expect((await get(n1, `/records/${rec}/comments`).expect(200)).body.items).toHaveLength(1);
    });
  });

  describe('記録を消したとき', () => {
    it('記録を消すと、付いていたスタンプとコメントも一緒に消える（ON DELETE CASCADE）', async () => {
      const { a1, a2 } = await world();
      const rec = await createRecord(a1);
      await http().post(`/api/records/${rec}/reactions`).set('Cookie', a2).send({ id: randomUUID(), stampKey: 'nice' }).expect(201);
      await http().post(`/api/records/${rec}/comments`).set('Cookie', a2).send({ id: randomUUID(), body: 'ナイス' }).expect(201);
      await http().delete(`/api/records/${rec}`).set('Cookie', a1).expect(204);
      expect(await countOf('reactions')).toBe(0);
      expect(await countOf('comments')).toBe(0);
    });
  });
});
