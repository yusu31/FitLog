import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createApp, migrateDb, resetDb, TEST_ORIGIN, withPool } from './helpers/app.js';

// 記録を作る（POST /records）の結合テスト（本物の PostgreSQL・本物の better-auth）。DATABASE_URL が無ければ「落ちる」（飛ばさない）。
const url = process.env.DATABASE_URL;

const cookieOf = (res: request.Response): string =>
  (res.headers['set-cookie'] as unknown as string[]).map((c) => c.split(';')[0]).join('; ');

type Row = { id: string; user_name: string; kind: string; recorded_at: Date; local_date: string };

// 2026-10-25 は日曜、2026-10-26 は月曜（docs/testing-design.md 3-3）
const SUN_LAST = '2026-10-25T14:59:59.000Z'; // 日本時間の日曜 23:59:59
const MON_FIRST = '2026-10-25T15:00:00.000Z'; // 日本時間の月曜 0:00:00

describe('記録を作る（結合: 本物の PostgreSQL・better-auth）', () => {
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

  let userSeq = 0;
  const signUpAs = async (name: string): Promise<string> => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/sign-up/email')
      .set('Origin', TEST_ORIGIN)
      .send({ email: `user${++userSeq}@example.com`, password: 'correct-horse-battery', name })
      .expect(200);
    return cookieOf(res);
  };

  const post = (cookie: string, body: unknown) => request(app.getHttpServer()).post('/api/records').set('Cookie', cookie).send(body as object);
  const workout = (recordedAt: string, id = randomUUID()) => ({ id, kind: 'workout', recordedAt });
  const rest = (recordedAt: string, id = randomUUID()) => ({ id, kind: 'rest', recordedAt });

  // DB を直接読む（作った順）。user_name は、誰の行かを見分けるため
  const rows = (): Promise<Row[]> =>
    withPool(url!, async (pool) =>
      (
        await pool.query(
          `SELECT r.id, u.name AS user_name, r.kind, r.recorded_at, r.local_date::text AS local_date
             FROM records r JOIN users u ON u.id = r.user_id ORDER BY r.created_at, r.id`,
        )
      ).rows,
    );

  it('Cookie なしでは 401', async () => {
    await request(app.getHttpServer()).post('/api/records').send(workout(SUN_LAST)).expect(401);
  });

  describe('筋トレの記録を作る', () => {
    it('201 で、id・kind・recordedAt・localDate（日本時間の日付）を返し、DB に1行入る', async () => {
      const cookie = await signUpAs('たろう');
      const body = workout('2026-10-26T03:00:00.000Z');
      const res = await post(cookie, body).expect(201);

      expect(res.body).toEqual({ id: body.id, kind: 'workout', recordedAt: '2026-10-26T03:00:00.000Z', localDate: '2026-10-26' });
      expect(await rows()).toEqual([expect.objectContaining({ id: body.id, user_name: 'たろう', kind: 'workout', local_date: '2026-10-26' })]);
    });

    // T-DATE-01・02（結）: API が日本時間の日付を保存する
    it('日曜 23:59:59（日本）は日曜、月曜 0:00:00（日本）は月曜の日付で保存する', async () => {
      const cookie = await signUpAs('たろう');
      const sun = await post(cookie, workout(SUN_LAST)).expect(201);
      const mon = await post(cookie, workout(MON_FIRST)).expect(201);

      expect(sun.body.localDate).toBe('2026-10-25');
      expect(mon.body.localDate).toBe('2026-10-26');
      expect((await rows()).map((r) => r.local_date)).toEqual(['2026-10-25', '2026-10-26']);
    });

    it('別の日の筋トレは、同じ日でも何件でも作れる（1日1件の制限は休みだけ）', async () => {
      const cookie = await signUpAs('たろう');
      await post(cookie, workout('2026-10-26T01:00:00.000Z')).expect(201);
      await post(cookie, workout('2026-10-26T05:00:00.000Z')).expect(201);
      expect(await rows()).toHaveLength(2);
    });
  });

  describe('入力の検査（400）', () => {
    // T-DATE-07（結）: 時刻の境目そのものは単体テストで確かめる（record-input.spec.ts）。ここは前後の代表
    it('未来の時刻は、1分先なら 201・10分先なら 400', async () => {
      const cookie = await signUpAs('たろう');
      await post(cookie, workout(new Date(Date.now() + 60_000).toISOString())).expect(201);
      const res = await post(cookie, workout(new Date(Date.now() + 600_000).toISOString())).expect(400);
      expect(res.body).toMatchObject({ code: 'VALIDATION_ERROR' });
      expect(await rows()).toHaveLength(1);
    });

    it('id が UUID でない・kind が run でも swim でも一覧外（swim）・recordedAt が日時でない は 400（DB のエラー 500 にしない）', async () => {
      const cookie = await signUpAs('たろう');
      await post(cookie, { ...workout(SUN_LAST), id: 'abc' }).expect(400);
      await post(cookie, { ...workout(SUN_LAST), kind: 'swim' }).expect(400);
      await post(cookie, { ...workout(SUN_LAST), recordedAt: 'あした' }).expect(400);
      await post(cookie, {}).expect(400);
      expect(await rows()).toHaveLength(0);
    });
  });

  // 冪等（F-30: 端末で作った ID。電波が戻ったあとの再送で二重にならない）
  describe('冪等（同じ id を送り直す）', () => {
    // T-OFF-01
    it('同じ id を2回送ると 201 → 200 で、DB は1行。2回目の応答は1回目と同じ', async () => {
      const cookie = await signUpAs('たろう');
      const body = workout(SUN_LAST);
      const first = await post(cookie, body).expect(201);
      const second = await post(cookie, body).expect(200);

      expect(second.body).toEqual(first.body);
      expect(await rows()).toHaveLength(1);
    });

    // T-OFF-03
    it('同じ id で中身を変えて送ると、1回目の内容が残る（2回目の中身は捨てられる）', async () => {
      const cookie = await signUpAs('たろう');
      const id = randomUUID();
      const first = await post(cookie, workout(SUN_LAST, id)).expect(201);
      const second = await post(cookie, rest(MON_FIRST, id)).expect(200);

      expect(second.body).toEqual(first.body);
      expect(await rows()).toEqual([expect.objectContaining({ id, kind: 'workout', local_date: '2026-10-25' })]);
    });

    // T-OFF-04: 他人の id とぶつかったら、存在を教えず 404。他人の行は変わらない
    it('他の人が作った記録と同じ id を送ると 404。元の行は変わらない', async () => {
      const taro = await signUpAs('たろう');
      const hanako = await signUpAs('はなこ');
      const id = randomUUID();
      await post(taro, workout(SUN_LAST, id)).expect(201);

      const res = await post(hanako, rest(MON_FIRST, id)).expect(404);
      expect(res.body).not.toHaveProperty('kind');
      expect(await rows()).toEqual([expect.objectContaining({ id, user_name: 'たろう', kind: 'workout' })]);
    });

    // T-OFF-06
    it('同時に同じ id を2つ送っても、1行で、どちらも成功する（201 と 200）', async () => {
      const cookie = await signUpAs('たろう');
      const body = workout(SUN_LAST);
      const results = await Promise.all([post(cookie, body), post(cookie, body)]);

      expect(results.map((r) => r.status).sort((a, b) => a - b)).toEqual([200, 201]);
      expect(results[0].body).toEqual(results[1].body);
      expect(await rows()).toHaveLength(1);
    });
  });

  // 休み（F-08）: 1日1件。docs/testing-design.md のデシジョンテーブル（休み）
  // F-21 あとから記録（docs/testing-design.md T-LATE-05〜08）
  describe('あとから記録（late。F-21）', () => {
    const lateRows = (): Promise<{ id: string; late: boolean }[]> =>
      withPool(url!, async (pool) => (await pool.query('SELECT id, late FROM records ORDER BY created_at, id')).rows);

    it('late: true で作ると 201 で late: true を返し、DB にも true が入る。付けなければ応答に late は無く DB は false', async () => {
      const cookie = await signUpAs('たろう');
      const late = { ...workout(SUN_LAST), late: true };
      const usual = workout(MON_FIRST);
      const res = await post(cookie, late).expect(201);
      const usualRes = await post(cookie, usual).expect(201);

      expect(res.body).toEqual({ id: late.id, kind: 'workout', recordedAt: SUN_LAST, localDate: '2026-10-25', late: true });
      expect(usualRes.body).not.toHaveProperty('late');
      expect(await lateRows()).toEqual([
        { id: late.id, late: true },
        { id: usual.id, late: false },
      ]);
    });

    it('同じ id で late を変えて送り直しても、1回目の late のまま（オフラインの再送で札が変わらない）', async () => {
      const cookie = await signUpAs('たろう');
      const body = { ...workout(SUN_LAST), late: true };
      await post(cookie, body).expect(201);
      const second = await post(cookie, { ...body, late: false }).expect(200);

      expect(second.body.late).toBe(true);
      expect(await lateRows()).toEqual([{ id: body.id, late: true }]);
    });

    it('休みを late: true で送ると 400 で、DB に入らない', async () => {
      const cookie = await signUpAs('たろう');
      const res = await post(cookie, { ...rest(SUN_LAST), late: true }).expect(400);

      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(await rows()).toEqual([]);
    });

    it('一覧と詳細にも late: true が出る', async () => {
      const cookie = await signUpAs('たろう');
      const body = { ...workout(SUN_LAST), late: true };
      await post(cookie, body).expect(201);

      const list = await request(app.getHttpServer()).get('/api/records').set('Cookie', cookie).expect(200);
      const detail = await request(app.getHttpServer()).get(`/api/records/${body.id}`).set('Cookie', cookie).expect(200);
      expect(list.body.items[0].late).toBe(true);
      expect(detail.body.late).toBe(true);
    });
  });

  describe('休みの記録（同じ日に1件）', () => {
    it('ケース1: その日に休みも運動も無いと 201。休みが1件', async () => {
      const cookie = await signUpAs('たろう');
      await post(cookie, rest(SUN_LAST)).expect(201);
      expect(await rows()).toHaveLength(1);
    });

    it('ケース4: 同じ日に別の id で休みを送ると、新しく作らず、すでにある休みを 200 で返す', async () => {
      const cookie = await signUpAs('たろう');
      const first = await post(cookie, rest('2026-10-26T01:00:00.000Z')).expect(201);
      const second = await post(cookie, rest('2026-10-26T09:00:00.000Z')).expect(200);

      expect(second.body.id).toBe(first.body.id);
      expect(second.body).toEqual(first.body);
      expect(await rows()).toHaveLength(1);
    });

    it('ケース3: その日に筋トレがあっても休みは 201 で作れ、休みも残る（逆の順でも同じ）', async () => {
      const cookie = await signUpAs('たろう');
      await post(cookie, workout('2026-10-26T01:00:00.000Z')).expect(201);
      await post(cookie, rest('2026-10-26T02:00:00.000Z')).expect(201);
      await post(cookie, rest('2026-10-27T01:00:00.000Z')).expect(201);
      await post(cookie, workout('2026-10-27T02:00:00.000Z')).expect(201);
      expect((await rows()).map((r) => r.kind)).toEqual(['workout', 'rest', 'rest', 'workout']);
    });

    // T-REST-05: 一意なのは (user_id, local_date)。日本時間の日付で数える
    it('日本時間で日付が変わる前後の休みは、別の日の休みとして2件作れる', async () => {
      const cookie = await signUpAs('たろう');
      await post(cookie, rest(SUN_LAST)).expect(201);
      await post(cookie, rest(MON_FIRST)).expect(201);
      expect((await rows()).map((r) => r.local_date)).toEqual(['2026-10-25', '2026-10-26']);
    });

    it('別の人が同じ日に休むのは、それぞれ 201（一意なのは人ごと）', async () => {
      const taro = await signUpAs('たろう');
      const hanako = await signUpAs('はなこ');
      await post(taro, rest(SUN_LAST)).expect(201);
      await post(hanako, rest(SUN_LAST)).expect(201);
      expect((await rows()).map((r) => r.user_name).sort()).toEqual(['たろう', 'はなこ']);
    });

    // T-REST-06
    it('同じ日の休みを別の id で同時に送っても、1件になり、どちらも成功する', async () => {
      const cookie = await signUpAs('たろう');
      const results = await Promise.all([post(cookie, rest(SUN_LAST)), post(cookie, rest(SUN_LAST))]);

      expect(results.map((r) => r.status).sort((a, b) => a - b)).toEqual([200, 201]);
      expect(results[0].body.id).toBe(results[1].body.id);
      expect(await rows()).toHaveLength(1);
    });
  });

  describe('表の制約（DB を直接検査）', () => {
    // 制約に違反する INSERT を試し、必ず ROLLBACK で元に戻す
    const rejected = (sql: string, params: unknown[]) =>
      withPool(url!, async (pool) => {
        await pool.query('BEGIN');
        try {
          await pool.query(sql, params);
          return undefined;
        } catch (err) {
          return (err as { code?: string }).code;
        } finally {
          await pool.query('ROLLBACK');
        }
      });

    it('存在しない user_id の記録は入れられない（参照制約違反 23503）', async () => {
      const code = await rejected(`INSERT INTO records (id, user_id, kind, recorded_at, local_date) VALUES ($1, 'no-such-user', 'workout', now(), current_date)`, [randomUUID()]);
      expect(code).toBe('23503');
    });
  });
});
