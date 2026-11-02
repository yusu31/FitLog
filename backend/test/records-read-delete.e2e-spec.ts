import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createApp, migrateDb, resetDb, TEST_ORIGIN, withPool } from './helpers/app.js';

// 記録の取り消し・一覧・詳細（DELETE /records/{id}/sets/{setId}・DELETE /records/{id}・GET /records・GET /records/{id}）の結合テスト。
// 本物の PostgreSQL・本物の better-auth。DATABASE_URL が無ければ「落ちる」（飛ばさない）。
const url = process.env.DATABASE_URL;

const cookieOf = (res: request.Response): string =>
  (res.headers['set-cookie'] as unknown as string[]).map((c) => c.split(';')[0]).join('; ');

// 一覧の種目は固定の ID で入っている（名前で探さず ID の定数で指す。docs/testing-design.md 7-1）
const BENCH_PRESS_ID = '00000000-0000-4000-8000-000000000001';
const SQUAT_ID = '00000000-0000-4000-8000-000000000024';
const RECORDED_AT = '2026-10-26T03:00:00.000Z';

describe('記録の取り消し・一覧・詳細（結合: 本物の PostgreSQL・better-auth）', () => {
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
      .send({ email: `rrd${++userSeq}@example.com`, password: 'correct-horse-battery', name })
      .expect(200);
    return cookieOf(res);
  };

  const createRecord = async (cookie: string, kind: 'workout' | 'run' | 'rest' = 'workout', recordedAt = RECORDED_AT, id = randomUUID()): Promise<string> => {
    const body = kind === 'run' ? { id, kind, recordedAt, run: { distanceM: 5000, durationS: 1800 } } : { id, kind, recordedAt };
    await http().post('/api/records').set('Cookie', cookie).send(body).expect(201);
    return id;
  };

  const addSet = async (cookie: string, recordId: string, exerciseId: string, setNo: number, weightKg = 40, reps = 10): Promise<string> => {
    const id = randomUUID();
    await http().post(`/api/records/${recordId}/sets`).set('Cookie', cookie).send({ id, exerciseId, setNo, weightKg, reps }).expect(201);
    return id;
  };

  // 作った人＋ (members - 1) 人のグループ。Cookie の配列を返す（先頭が作った人）
  const groupWith = async (members: number): Promise<string[]> => {
    const cookies = [await signUpAs('おや')];
    await http().post('/api/groups').set('Cookie', cookies[0]).send({ name: '朝トレ部' }).expect(201);
    const { token } = (await http().post('/api/groups/current/invitations').set('Cookie', cookies[0]).expect(201)).body as { token: string };
    for (let i = 1; i < members; i++) {
      const c = await signUpAs(`なかま${i}`);
      await http().post(`/api/invitations/${token}/accept`).set('Cookie', c).expect(200);
      cookies.push(c);
    }
    return cookies;
  };

  const count = (table: 'records' | 'workout_sets' | 'run_details'): Promise<number> =>
    withPool(url!, async (pool) => Number((await pool.query(`SELECT count(*) AS n FROM ${table}`)).rows[0].n));

  // 一覧の確認用に、記録を SQL でまとめて入れる（API で数十件作ると遅いので）。recordedAt は 1 分刻みで古くなる
  const bulkInsert = (email: string, n: number, kind: 'workout' | 'run' | 'rest' = 'workout'): Promise<void> =>
    withPool(url!, async (pool) => {
      await pool.query(
        `INSERT INTO records (id, user_id, kind, recorded_at, local_date)
         SELECT gen_random_uuid(), u.id, $2::record_kind, timestamptz '2026-10-26T12:00:00Z' - (g || ' minutes')::interval, date '2026-10-26'
         FROM users u, generate_series(1, $3::int) AS g WHERE u.email = $1`,
        [email, kind, n],
      );
    });

  const emailOf = (seq: number) => `rrd${seq}@example.com`;

  describe('DELETE /records/{id}/sets/{setId}（セットの取り消し）', () => {
    const del = (cookie: string | undefined, recordId: string, setId: string) => {
      const r = http().delete(`/api/records/${recordId}/sets/${setId}`);
      return cookie ? r.set('Cookie', cookie) : r;
    };

    it('Cookie なしでは 401', async () => {
      await del(undefined, randomUUID(), randomUUID()).expect(401);
    });

    it('自分のセットは 204（本文なし）。そのセットだけが消え、同じ記録の他のセットと記録は残る', async () => {
      const cookie = await signUpAs('たろう');
      const recordId = await createRecord(cookie);
      const keep = await addSet(cookie, recordId, BENCH_PRESS_ID, 1);
      const gone = await addSet(cookie, recordId, BENCH_PRESS_ID, 2);

      const res = await del(cookie, recordId, gone).expect(204);
      expect(res.text).toBe('');

      const ids = await withPool(url!, async (pool) => (await pool.query('SELECT id FROM workout_sets')).rows.map((r) => r.id));
      expect(ids).toEqual([keep]);
      expect(await count('records')).toBe(1);
    });

    // 再送の扱い: 消したあとの2回目は 404（消えた行の持ち主は分からないので、他人のものや無い id と同じ応答にそろえる）
    it('同じセットをもう一度消すと 404 SET_NOT_FOUND（二重削除。他の行は巻き込まれない）', async () => {
      const cookie = await signUpAs('たろう');
      const recordId = await createRecord(cookie);
      const keep = await addSet(cookie, recordId, BENCH_PRESS_ID, 1);
      const gone = await addSet(cookie, recordId, BENCH_PRESS_ID, 2);
      await del(cookie, recordId, gone).expect(204);

      const res = await del(cookie, recordId, gone).expect(404);
      expect(res.body.code).toBe('SET_NOT_FOUND');
      const ids = await withPool(url!, async (pool) => (await pool.query('SELECT id FROM workout_sets')).rows.map((r) => r.id));
      expect(ids).toEqual([keep]);
    });

    it('他の人の記録のセットは 404 で、消えない（存在しない id と同じ応答）', async () => {
      const owner = await signUpAs('もちぬし');
      const stranger = await signUpAs('よそのひと');
      const recordId = await createRecord(owner);
      const setId = await addSet(owner, recordId, BENCH_PRESS_ID, 1);

      const res = await del(stranger, recordId, setId).expect(404);
      expect(res.body.code).toBe('RECORD_NOT_FOUND');
      expect(await count('workout_sets')).toBe(1);

      // 無い記録 id と同じ形・同じ文言（存在を教えない）
      const none = await del(stranger, randomUUID(), randomUUID()).expect(404);
      expect(none.body).toEqual(res.body);
    });

    it('同じグループの人のセットも 404 で、消えない（消せるのは自分のだけ）', async () => {
      const [owner, mate] = await groupWith(2);
      const recordId = await createRecord(owner);
      const setId = await addSet(owner, recordId, BENCH_PRESS_ID, 1);
      await del(mate, recordId, setId).expect(404);
      expect(await count('workout_sets')).toBe(1);
    });

    it('自分の記録でも、別の記録のセットの id を指すと 404 SET_NOT_FOUND で、消えない', async () => {
      const cookie = await signUpAs('たろう');
      const recordA = await createRecord(cookie);
      const recordB = await createRecord(cookie, 'workout', '2026-10-27T03:00:00.000Z');
      const setOfB = await addSet(cookie, recordB, BENCH_PRESS_ID, 1);

      const res = await del(cookie, recordA, setOfB).expect(404);
      expect(res.body.code).toBe('SET_NOT_FOUND');
      expect(await count('workout_sets')).toBe(1);
    });

    it('他の人のセットの id を、自分の記録の下に付けても 404 で、消えない', async () => {
      const cookie = await signUpAs('たろう');
      const other = await signUpAs('よそのひと');
      const mine = await createRecord(cookie);
      const theirs = await createRecord(other);
      const theirSet = await addSet(other, theirs, BENCH_PRESS_ID, 1);
      await del(cookie, mine, theirSet).expect(404);
      expect(await count('workout_sets')).toBe(1);
    });

    it.each([['記録 id が UUID でない', 'abc', '00000000-0000-4000-8000-0000000000aa'], ['セット id が UUID でない', '00000000-0000-4000-8000-0000000000aa', 'abc']])(
      '%s は 500 でなく 404',
      async (_name, recordId, setId) => {
        const cookie = await signUpAs('たろう');
        await del(cookie, recordId, setId).expect(404);
      },
    );

    it('消したあと、同じセット番号に別の id でセットを足し直せる（取り消しは番号を空ける）', async () => {
      const cookie = await signUpAs('たろう');
      const recordId = await createRecord(cookie);
      const first = await addSet(cookie, recordId, BENCH_PRESS_ID, 1);
      await del(cookie, recordId, first).expect(204);
      await addSet(cookie, recordId, BENCH_PRESS_ID, 1, 50, 8);
      expect(await count('workout_sets')).toBe(1);
    });
  });

  describe('DELETE /records/{id}（記録の取り消し）', () => {
    const del = (cookie: string | undefined, recordId: string) => {
      const r = http().delete(`/api/records/${recordId}`);
      return cookie ? r.set('Cookie', cookie) : r;
    };

    it('Cookie なしでは 401', async () => {
      await del(undefined, randomUUID()).expect(401);
    });

    it('自分の筋トレの記録は 204（本文なし）。セットも一緒に消える（CASCADE）', async () => {
      const cookie = await signUpAs('たろう');
      const recordId = await createRecord(cookie);
      await addSet(cookie, recordId, BENCH_PRESS_ID, 1);
      await addSet(cookie, recordId, SQUAT_ID, 1);

      const res = await del(cookie, recordId).expect(204);
      expect(res.text).toBe('');
      expect(await count('records')).toBe(0);
      expect(await count('workout_sets')).toBe(0);
    });

    it('自分のランの記録は 204。距離・時間の詳細も一緒に消える（CASCADE）', async () => {
      const cookie = await signUpAs('たろう');
      const recordId = await createRecord(cookie, 'run');
      expect(await count('run_details')).toBe(1);
      await del(cookie, recordId).expect(204);
      expect(await count('records')).toBe(0);
      expect(await count('run_details')).toBe(0);
    });

    it('自分の休みの記録も 204', async () => {
      const cookie = await signUpAs('たろう');
      const recordId = await createRecord(cookie, 'rest');
      await del(cookie, recordId).expect(204);
      expect(await count('records')).toBe(0);
    });

    it('消したのは指定した1件だけ。自分の他の記録・他の人の記録は残る', async () => {
      const a = await signUpAs('たろう');
      const b = await signUpAs('はなこ');
      const target = await createRecord(a);
      const mineOther = await createRecord(a, 'workout', '2026-10-27T03:00:00.000Z');
      const theirs = await createRecord(b);
      await addSet(a, mineOther, BENCH_PRESS_ID, 1);
      await addSet(b, theirs, BENCH_PRESS_ID, 1);

      await del(a, target).expect(204);
      const ids = await withPool(url!, async (pool) => (await pool.query('SELECT id FROM records ORDER BY id')).rows.map((r) => r.id));
      expect(ids.toSorted((x, y) => x.localeCompare(y))).toEqual([mineOther, theirs].toSorted((x, y) => x.localeCompare(y)));
      expect(await count('workout_sets')).toBe(2);
    });

    // 再送の扱い（T-OFF）: 消したあとの2回目は 404 RECORD_NOT_FOUND
    it('同じ記録をもう一度消すと 404 RECORD_NOT_FOUND（二重削除）', async () => {
      const cookie = await signUpAs('たろう');
      const recordId = await createRecord(cookie);
      await del(cookie, recordId).expect(204);
      const res = await del(cookie, recordId).expect(404);
      expect(res.body.code).toBe('RECORD_NOT_FOUND');
    });

    it('他の人の記録は 404 で、消えない（セットも残る）。存在しない id と同じ応答', async () => {
      const owner = await signUpAs('もちぬし');
      const stranger = await signUpAs('よそのひと');
      const recordId = await createRecord(owner);
      await addSet(owner, recordId, BENCH_PRESS_ID, 1);

      const res = await del(stranger, recordId).expect(404);
      expect(res.body.code).toBe('RECORD_NOT_FOUND');
      expect(await count('records')).toBe(1);
      expect(await count('workout_sets')).toBe(1);

      const none = await del(stranger, randomUUID()).expect(404);
      expect(none.body).toEqual(res.body);
    });

    it('同じグループの人の記録も 404 で、消えない（消せるのは自分のだけ）', async () => {
      const [owner, mate] = await groupWith(2);
      const recordId = await createRecord(owner);
      await del(mate, recordId).expect(404);
      expect(await count('records')).toBe(1);
    });

    it('UUID でない id は 500 でなく 404', async () => {
      const cookie = await signUpAs('たろう');
      await del(cookie, 'abc').expect(404);
    });

    it('大文字の UUID でも、自分の記録を消せる', async () => {
      const cookie = await signUpAs('たろう');
      const recordId = await createRecord(cookie);
      await del(cookie, recordId.toUpperCase()).expect(204);
      expect(await count('records')).toBe(0);
    });

    it('消したあと、前回（ゴースト）の元から外れる', async () => {
      const cookie = await signUpAs('たろう');
      const old = await createRecord(cookie, 'workout', '2026-10-20T03:00:00.000Z');
      await addSet(cookie, old, BENCH_PRESS_ID, 1, 60, 5);
      const before = await http().get(`/api/exercises/${BENCH_PRESS_ID}/previous`).set('Cookie', cookie).expect(200);
      expect(before.body.previous).not.toBeNull();

      await del(cookie, old).expect(204);
      const after = await http().get(`/api/exercises/${BENCH_PRESS_ID}/previous`).set('Cookie', cookie).expect(200);
      expect(after.body.previous).toBeNull();
    });
  });

  describe('GET /records（自分の記録の一覧）', () => {
    const list = (cookie: string | undefined, query = '') => {
      const r = http().get(`/api/records${query}`);
      return cookie ? r.set('Cookie', cookie) : r;
    };

    it('Cookie なしでは 401', async () => {
      await list(undefined).expect(401);
    });

    it('記録が無ければ items は空・nextCursor は null', async () => {
      const cookie = await signUpAs('たろう');
      const res = await list(cookie).expect(200);
      expect(res.body).toEqual({ items: [], nextCursor: null });
    });

    it('自分の記録だけが、新しい順に並ぶ（他の人・同じグループの人の記録は入らない）', async () => {
      const [me, mate] = await groupWith(2);
      const oldest = await createRecord(me, 'rest', '2026-10-24T03:00:00.000Z');
      const newest = await createRecord(me, 'workout', '2026-10-28T03:00:00.000Z');
      const middle = await createRecord(me, 'run', '2026-10-26T03:00:00.000Z');
      await createRecord(mate, 'workout', '2026-10-27T03:00:00.000Z');
      const stranger = await signUpAs('よそのひと');
      await createRecord(stranger, 'workout', '2026-10-29T03:00:00.000Z');

      const res = await list(me).expect(200);
      expect(res.body.items.map((r: { id: string }) => r.id)).toEqual([newest, middle, oldest]);
      expect(res.body.nextCursor).toBeNull();
    });

    it('同じ時刻の記録は id の降順で並ぶ（順番が毎回同じ）', async () => {
      const cookie = await signUpAs('たろう');
      const ids = [await createRecord(cookie), await createRecord(cookie), await createRecord(cookie)];
      const res = await list(cookie).expect(200);
      expect(res.body.items.map((r: { id: string }) => r.id)).toEqual([...ids].sort().reverse());
    });

    // 同値分割: ちょうど / 1つ多い / 2ページちょうど / 2ページ + 1。重複も抜けもないこと
    it.each([
      [20, [20]],
      [21, [20, 1]],
      [40, [20, 20]],
      [41, [20, 20, 1]],
    ])('既定の limit 20: %i 件は %j 件ずつのページに分かれ、重複も抜けもない', async (total, pageSizes) => {
      const cookie = await signUpAs('たろう');
      await bulkInsert(emailOf(userSeq), total);

      const seen: string[] = [];
      let cursor: string | null = null;
      for (const [i, size] of pageSizes.entries()) {
        const res: request.Response = await list(cookie, cursor ? `?cursor=${encodeURIComponent(cursor)}` : '').expect(200);
        expect(res.body.items).toHaveLength(size);
        seen.push(...res.body.items.map((r: { id: string }) => r.id));
        cursor = res.body.nextCursor;
        // 最後のページだけ nextCursor が null（ちょうど割り切れる 20・40 件でも、空のページを返さない）
        if (i < pageSizes.length - 1) expect(cursor).not.toBeNull();
        else expect(cursor).toBeNull();
      }
      expect(new Set(seen).size).toBe(total);
      const all = await withPool(url!, async (pool) => (await pool.query('SELECT id FROM records ORDER BY recorded_at DESC, id DESC')).rows.map((r) => r.id));
      expect(seen).toEqual(all);
    });

    it('limit=1 は1件ずつ。続きの cursor で全件を一度ずつ読める', async () => {
      const cookie = await signUpAs('たろう');
      await bulkInsert(emailOf(userSeq), 3);
      const seen: string[] = [];
      let cursor: string | null = null;
      for (let i = 0; i < 3; i++) {
        const res: request.Response = await list(cookie, `?limit=1${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`).expect(200);
        expect(res.body.items).toHaveLength(1);
        seen.push(res.body.items[0].id);
        cursor = res.body.nextCursor;
      }
      expect(cursor).toBeNull();
      expect(new Set(seen).size).toBe(3);
    });

    it('同じ時刻の記録が複数あっても、limit=1 で続きを読むと重複も抜けもない（cursor は時刻と id の組）', async () => {
      const cookie = await signUpAs('たろう');
      const ids = [await createRecord(cookie), await createRecord(cookie), await createRecord(cookie)];
      const seen: string[] = [];
      let cursor: string | null = null;
      for (let i = 0; i < 3; i++) {
        const res: request.Response = await list(cookie, `?limit=1${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`).expect(200);
        seen.push(...res.body.items.map((r: { id: string }) => r.id));
        cursor = res.body.nextCursor;
      }
      expect(cursor).toBeNull();
      expect(seen).toEqual(ids.toSorted((x, y) => y.localeCompare(x)));
    });

    it('limit=100（上端）は通り、limit=101・0・abc は 400 VALIDATION_ERROR', async () => {
      const cookie = await signUpAs('たろう');
      await list(cookie, '?limit=100').expect(200);
      for (const bad of ['101', '0', '-1', 'abc', '1.5']) {
        const res = await list(cookie, `?limit=${bad}`).expect(400);
        expect(res.body.code).toBe('VALIDATION_ERROR');
      }
    });

    it('kind で絞れる。絞った上でも cursor の続きが正しい', async () => {
      const cookie = await signUpAs('たろう');
      const w1 = await createRecord(cookie, 'workout', '2026-10-24T03:00:00.000Z');
      const r1 = await createRecord(cookie, 'run', '2026-10-25T03:00:00.000Z');
      const w2 = await createRecord(cookie, 'workout', '2026-10-26T03:00:00.000Z');
      const rest = await createRecord(cookie, 'rest', '2026-10-27T03:00:00.000Z');

      const ids = (res: request.Response) => res.body.items.map((r: { id: string }) => r.id);
      expect(ids(await list(cookie, '?kind=workout').expect(200))).toEqual([w2, w1]);
      expect(ids(await list(cookie, '?kind=run').expect(200))).toEqual([r1]);
      expect(ids(await list(cookie, '?kind=rest').expect(200))).toEqual([rest]);

      const page1 = await list(cookie, '?kind=workout&limit=1').expect(200);
      expect(ids(page1)).toEqual([w2]);
      const page2 = await list(cookie, `?kind=workout&limit=1&cursor=${encodeURIComponent(page1.body.nextCursor)}`).expect(200);
      expect(ids(page2)).toEqual([w1]);
      expect(page2.body.nextCursor).toBeNull();
    });

    it('kind が workout/run/rest でなければ 400、壊れた cursor も 400', async () => {
      const cookie = await signUpAs('たろう');
      expect((await list(cookie, '?kind=swim').expect(400)).body.code).toBe('VALIDATION_ERROR');
      expect((await list(cookie, '?cursor=でたらめ').expect(400)).body.code).toBe('VALIDATION_ERROR');
    });

    it('他の人が作った cursor を渡しても、自分の記録しか出ない', async () => {
      const a = await signUpAs('たろう');
      const b = await signUpAs('はなこ');
      await bulkInsert(emailOf(userSeq - 1), 3);
      await bulkInsert(emailOf(userSeq), 3);
      const pageOfB = await list(b, '?limit=1').expect(200);
      const res = await list(a, `?cursor=${encodeURIComponent(pageOfB.body.nextCursor)}`).expect(200);
      expect(res.body.items.length).toBeGreaterThan(0);
      const ownerIds = await withPool(url!, async (pool) =>
        (await pool.query(`SELECT r.id FROM records r JOIN users u ON u.id = r.user_id WHERE u.email = $1`, [emailOf(userSeq - 1)])).rows.map((r) => r.id),
      );
      for (const item of res.body.items) expect(ownerIds).toContain(item.id);
    });

    it('筋トレの記録は、種目ごとのセットを含む（種目は最初に足した順・セットはセット番号順）。ランは run、休みはどちらも付かない', async () => {
      const cookie = await signUpAs('たろう');
      const workout = await createRecord(cookie, 'workout', '2026-10-28T03:00:00.000Z');
      const squat2 = await addSet(cookie, workout, SQUAT_ID, 2, 80, 5);
      const squat1 = await addSet(cookie, workout, SQUAT_ID, 1, 70, 8);
      const bench1 = await addSet(cookie, workout, BENCH_PRESS_ID, 1, 40, 10);
      const run = await createRecord(cookie, 'run', '2026-10-27T03:00:00.000Z');
      const rest = await createRecord(cookie, 'rest', '2026-10-26T03:00:00.000Z');

      const names = await withPool(url!, async (pool) =>
        Object.fromEntries((await pool.query('SELECT id, name FROM exercises WHERE id = ANY($1)', [[BENCH_PRESS_ID, SQUAT_ID]])).rows.map((r) => [r.id, r.name])),
      );

      const res = await list(cookie).expect(200);
      expect(res.body.items).toEqual([
        {
          id: workout,
          kind: 'workout',
          recordedAt: '2026-10-28T03:00:00.000Z',
          localDate: '2026-10-28',
          exercises: [
            {
              exerciseId: SQUAT_ID,
              name: names[SQUAT_ID],
              sets: [
                { id: squat1, setNo: 1, weightKg: 70, reps: 8 },
                { id: squat2, setNo: 2, weightKg: 80, reps: 5 },
              ],
            },
            { exerciseId: BENCH_PRESS_ID, name: names[BENCH_PRESS_ID], sets: [{ id: bench1, setNo: 1, weightKg: 40, reps: 10 }] },
          ],
        },
        { id: run, kind: 'run', recordedAt: '2026-10-27T03:00:00.000Z', localDate: '2026-10-27', run: { distanceM: 5000, durationS: 1800 } },
        { id: rest, kind: 'rest', recordedAt: '2026-10-26T03:00:00.000Z', localDate: '2026-10-26' },
      ]);
    });

    it('セットが1つも無い筋トレの記録は exercises が空の配列', async () => {
      const cookie = await signUpAs('たろう');
      const workout = await createRecord(cookie);
      const res = await list(cookie).expect(200);
      expect(res.body.items).toEqual([{ id: workout, kind: 'workout', recordedAt: RECORDED_AT, localDate: '2026-10-26', exercises: [] }]);
    });

    it('kind=workout&limit=1 は、いちばん新しい筋トレ（今日のメニューの材料）', async () => {
      const cookie = await signUpAs('たろう');
      await createRecord(cookie, 'workout', '2026-10-24T03:00:00.000Z');
      const latest = await createRecord(cookie, 'workout', '2026-10-26T03:00:00.000Z');
      await createRecord(cookie, 'run', '2026-10-28T03:00:00.000Z');
      const res = await list(cookie, '?kind=workout&limit=1').expect(200);
      expect(res.body.items.map((r: { id: string }) => r.id)).toEqual([latest]);
      expect(res.body.nextCursor).not.toBeNull();
    });

    it('取り消した記録・セットは一覧に出ない', async () => {
      const cookie = await signUpAs('たろう');
      const keep = await createRecord(cookie, 'workout', '2026-10-27T03:00:00.000Z');
      const goneSet = await addSet(cookie, keep, BENCH_PRESS_ID, 1);
      const goneRecord = await createRecord(cookie, 'workout', '2026-10-28T03:00:00.000Z');
      await http().delete(`/api/records/${keep}/sets/${goneSet}`).set('Cookie', cookie).expect(204);
      await http().delete(`/api/records/${goneRecord}`).set('Cookie', cookie).expect(204);

      const res = await list(cookie).expect(200);
      expect(res.body.items).toEqual([{ id: keep, kind: 'workout', recordedAt: '2026-10-27T03:00:00.000Z', localDate: '2026-10-27', exercises: [] }]);
    });
  });

  describe('GET /records/{id}（記録の詳細）', () => {
    const detail = (cookie: string | undefined, recordId: string) => {
      const r = http().get(`/api/records/${recordId}`);
      return cookie ? r.set('Cookie', cookie) : r;
    };

    it('Cookie なしでは 401', async () => {
      await detail(undefined, randomUUID()).expect(401);
    });

    it('自分の筋トレの記録は 200。セットが種目ごとに入る', async () => {
      const cookie = await signUpAs('たろう');
      const recordId = await createRecord(cookie);
      const s1 = await addSet(cookie, recordId, BENCH_PRESS_ID, 1, 40, 10);
      const res = await detail(cookie, recordId).expect(200);
      expect(res.body).toMatchObject({ id: recordId, kind: 'workout', recordedAt: RECORDED_AT, localDate: '2026-10-26' });
      expect(res.body.exercises).toEqual([expect.objectContaining({ exerciseId: BENCH_PRESS_ID, sets: [{ id: s1, setNo: 1, weightKg: 40, reps: 10 }] })]);
    });

    it('ランは run（距離と時間）、休みは run も exercises も付かない', async () => {
      const cookie = await signUpAs('たろう');
      const run = await createRecord(cookie, 'run');
      const rest = await createRecord(cookie, 'rest', '2026-10-27T03:00:00.000Z');
      const r = await detail(cookie, run).expect(200);
      expect(r.body).toEqual({ id: run, kind: 'run', recordedAt: RECORDED_AT, localDate: '2026-10-26', run: { distanceM: 5000, durationS: 1800 } });
      const z = await detail(cookie, rest).expect(200);
      expect(z.body).toEqual({ id: rest, kind: 'rest', recordedAt: '2026-10-27T03:00:00.000Z', localDate: '2026-10-27' });
    });

    // 3-7 の表: 自分 200／同じグループの人 200／別のグループの人 404／グループに入っていない人 404／ログインしていない 401
    it('見られるのは自分と同じグループの人だけ。別のグループ・グループなし・存在しない id は 404 で、どれも同じ応答', async () => {
      const [owner, mate] = await groupWith(2);
      const recordId = await createRecord(owner);
      await addSet(owner, recordId, BENCH_PRESS_ID, 1);

      // 別のグループ（A とは別に B をつくる）
      const otherOwner = await signUpAs('べつのおや');
      await http().post('/api/groups').set('Cookie', otherOwner).send({ name: 'べつ部' }).expect(201);
      const loner = await signUpAs('ひとり');

      expect((await detail(owner, recordId).expect(200)).body.id).toBe(recordId);
      const viaMate = await detail(mate, recordId).expect(200);
      expect(viaMate.body.id).toBe(recordId);
      expect(viaMate.body.exercises).toHaveLength(1);

      const fromOtherGroup = await detail(otherOwner, recordId).expect(404);
      const fromLoner = await detail(loner, recordId).expect(404);
      const missing = await detail(otherOwner, randomUUID()).expect(404);
      expect(fromOtherGroup.body.code).toBe('RECORD_NOT_FOUND');
      expect(fromLoner.body).toEqual(fromOtherGroup.body);
      expect(missing.body).toEqual(fromOtherGroup.body);
      // 他人の記録の中身は 404 の本文に出ない
      expect(JSON.stringify(fromOtherGroup.body)).not.toContain(recordId);
    });

    it('グループに入っていない人が、自分の記録を見るのは 200', async () => {
      const loner = await signUpAs('ひとり');
      const recordId = await createRecord(loner);
      await detail(loner, recordId).expect(200);
    });

    it('グループを出た人の記録は、出たあとは仲間から 404（T-GRP-07）', async () => {
      const [owner, mate] = await groupWith(2);
      const recordId = await createRecord(owner);
      await detail(mate, recordId).expect(200);
      await http().delete('/api/groups/current/members/me').set('Cookie', owner).expect(204);
      await detail(mate, recordId).expect(404);
      await detail(owner, recordId).expect(200);
    });

    it('UUID でない id は 500 でなく 404。大文字の UUID でも見られる', async () => {
      const cookie = await signUpAs('たろう');
      await detail(cookie, 'abc').expect(404);
      const recordId = await createRecord(cookie);
      await detail(cookie, recordId.toUpperCase()).expect(200);
    });

    it('取り消した記録は 404', async () => {
      const cookie = await signUpAs('たろう');
      const recordId = await createRecord(cookie);
      await http().delete(`/api/records/${recordId}`).set('Cookie', cookie).expect(204);
      await detail(cookie, recordId).expect(404);
    });
  });
});
