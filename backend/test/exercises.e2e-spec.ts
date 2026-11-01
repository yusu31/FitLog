import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { BODY_PARTS } from '../src/db/schema.js';
import { createApp, migrateDb, resetDb, TEST_ORIGIN, withPool } from './helpers/app.js';

// 種目の一覧と追加の結合テスト（本物の PostgreSQL・本物の better-auth）。DATABASE_URL が無ければ「落ちる」（飛ばさない）。
const url = process.env.DATABASE_URL;

const cookieOf = (res: request.Response): string =>
  (res.headers['set-cookie'] as unknown as string[]).map((c) => c.split(';')[0]).join('; ');

type Exercise = {
  id: string;
  name: string;
  bodyPart: string;
  isCustom: boolean;
  trialWeightKg: number | null;
  trialReps: number | null;
};

// 一覧の種目の総数（docs/database-design.md「一覧の種目」の30件）。種目を足す・減らすマイグレーションを入れたら、ここも直す。
// 部位ごとの件数は数えない（body_part は仮置き。docs/testing-design.md 7-1）
const COMMON_TOTAL = 30;
// 一覧の種目は固定の ID で入っている。名前で探さず、ID の定数で指す（名前を直してもテストが壊れないように。同 7-1）
const BENCH_PRESS_ID = '00000000-0000-4000-8000-000000000001';
const PUSH_UP_ID = '00000000-0000-4000-8000-000000000004'; // 自重の種目（お試しの重量が 0）

describe('種目の一覧と追加（結合: 本物の PostgreSQL・better-auth）', () => {
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

  const list = async (cookie: string): Promise<Exercise[]> =>
    (await request(app.getHttpServer()).get('/api/exercises').set('Cookie', cookie).expect(200)).body;

  const add = (cookie: string, body: unknown) => request(app.getHttpServer()).post('/api/exercises').set('Cookie', cookie).send(body as object);

  it('Cookie なしでは、どの道も 401', async () => {
    const http = request(app.getHttpServer());
    await http.get('/api/exercises').expect(401);
    await http.post('/api/exercises').send({ name: 'x', bodyPart: 'abs' }).expect(401);
  });

  describe('GET /exercises（一覧の種目30件）', () => {
    it('登録しただけの人に、一覧の種目が30件返り、部位はどれも body_part の値', async () => {
      const cookie = await signUpAs('たろう');
      const items = await list(cookie);

      expect(items).toHaveLength(COMMON_TOTAL);
      for (const e of items) expect(BODY_PARTS).toContain(e.bodyPart);
    });

    it('一覧の種目は isCustom=false で、お試しの前回値（重量・回数）を持つ', async () => {
      const cookie = await signUpAs('たろう');
      const bench = (await list(cookie)).find((e) => e.id === BENCH_PRESS_ID);

      expect(bench).toEqual({
        id: BENCH_PRESS_ID,
        name: expect.any(String),
        bodyPart: expect.any(String),
        isCustom: false,
        trialWeightKg: expect.any(Number),
        trialReps: expect.any(Number),
      });
    });

    it('並びは部位の順（body_part の宣言順）。同じ部位の一覧の種目どうしは、固定の ID の順（＝一覧の並び）', async () => {
      const cookie = await signUpAs('たろう');
      const items = await list(cookie);

      const partIndexes = items.map((e) => BODY_PARTS.indexOf(e.bodyPart as (typeof BODY_PARTS)[number]));
      expect(partIndexes).toEqual([...partIndexes].sort((a, b) => a - b));
      for (let i = 1; i < items.length; i++) {
        if (items[i - 1].bodyPart === items[i].bodyPart) expect(items[i - 1].id < items[i].id).toBe(true);
      }
    });

    it('自重の種目（腕立て伏せ）の重量は 0。null ではない', async () => {
      const cookie = await signUpAs('たろう');
      const pushUp = (await list(cookie)).find((e) => e.id === PUSH_UP_ID);
      expect(pushUp?.trialWeightKg).toBe(0);
      expect(pushUp?.trialReps).toEqual(expect.any(Number));
    });
  });

  describe('POST /exercises（自分用の種目を追加）', () => {
    it('追加すると 201。一覧には、自分の種目が isCustom=true・お試し値なしで出る', async () => {
      const cookie = await signUpAs('たろう');
      const res = await add(cookie, { name: 'ヨガ', bodyPart: 'abs' }).expect(201);

      expect(res.body).toEqual({
        id: expect.any(String),
        name: 'ヨガ',
        bodyPart: 'abs',
        isCustom: true,
        trialWeightKg: null,
        trialReps: null,
      });
      const items = await list(cookie);
      expect(items).toHaveLength(COMMON_TOTAL + 1);
      expect(items.find((e) => e.id === res.body.id)).toEqual(res.body);
    });

    // T-EXR-01〜03: 名前の文字数の限界値
    it('名前は 0字 400／1字 201／30字 201／31字 400', async () => {
      const cookie = await signUpAs('たろう');
      const res0 = await add(cookie, { name: '', bodyPart: 'abs' }).expect(400);
      expect(res0.body).toMatchObject({ code: 'VALIDATION_ERROR' });
      await add(cookie, { name: '橋', bodyPart: 'abs' }).expect(201);
      await add(cookie, { name: 'あ'.repeat(30), bodyPart: 'abs' }).expect(201);
      await add(cookie, { name: 'あ'.repeat(31), bodyPart: 'abs' }).expect(400);
    });

    it('部位が一覧に無い値・無いときは 400（DB のエラー 500 にしない）', async () => {
      const cookie = await signUpAs('たろう');
      await add(cookie, { name: 'ヨガ', bodyPart: 'neck' }).expect(400);
      await add(cookie, { name: 'ヨガ' }).expect(400);
      await add(cookie, {}).expect(400);
    });

    // T-EXR-04
    it('同じ名前を自分用に2回追加すると、2回目は 409', async () => {
      const cookie = await signUpAs('たろう');
      await add(cookie, { name: 'ヨガ', bodyPart: 'abs' }).expect(201);
      const res = await add(cookie, { name: 'ヨガ', bodyPart: 'legs' }).expect(409);
      expect(res.body).toMatchObject({ code: 'EXERCISE_ALREADY_EXISTS' });
      expect(await list(cookie)).toHaveLength(COMMON_TOTAL + 1);
    });

    // T-EXR-06
    it('大文字小文字だけ違う名前（Plank の後に plank）は 409', async () => {
      const cookie = await signUpAs('たろう');
      await add(cookie, { name: 'Plank', bodyPart: 'abs' }).expect(201);
      await add(cookie, { name: 'plank', bodyPart: 'abs' }).expect(409);
    });

    it('前後の空白は取り除いて比べる（" Plank " は Plank と同じ名前）', async () => {
      const cookie = await signUpAs('たろう');
      await add(cookie, { name: 'Plank', bodyPart: 'abs' }).expect(201);
      await add(cookie, { name: ' Plank ', bodyPart: 'abs' }).expect(409);
    });

    // T-EXR-07
    it('一覧の種目と同じ名前を自分用に追加すると 409（索引では守れないので API で確かめる）', async () => {
      const cookie = await signUpAs('たろう');
      const common = (await list(cookie)).find((e) => e.id === BENCH_PRESS_ID)!;
      const res = await add(cookie, { name: common.name, bodyPart: common.bodyPart }).expect(409);
      expect(res.body).toMatchObject({ code: 'EXERCISE_ALREADY_EXISTS' });
      expect(await list(cookie)).toHaveLength(COMMON_TOTAL);
    });

    // T-EXR-08
    it('別の人が同じ名前を追加するのは 201（一意なのは作者ごと）', async () => {
      const taro = await signUpAs('たろう');
      const hanako = await signUpAs('はなこ');
      const a = await add(taro, { name: 'ヨガ', bodyPart: 'abs' }).expect(201);
      const b = await add(hanako, { name: 'ヨガ', bodyPart: 'abs' }).expect(201);
      expect(a.body.id).not.toBe(b.body.id);
    });

    it('他の人が追加した種目は、自分の一覧には出ない', async () => {
      const taro = await signUpAs('たろう');
      const hanako = await signUpAs('はなこ');
      await add(taro, { name: 'ヨガ', bodyPart: 'abs' }).expect(201);

      const hanakoItems = await list(hanako);
      expect(hanakoItems).toHaveLength(COMMON_TOTAL);
      expect(hanakoItems.some((e) => e.name === 'ヨガ')).toBe(false);
    });

    it('同時に同じ名前を2回送ると、1件だけ 201 で、もう1件は 409（索引が守る）', async () => {
      const cookie = await signUpAs('たろう');
      const results = await Promise.all([add(cookie, { name: 'ヨガ', bodyPart: 'abs' }), add(cookie, { name: 'ヨガ', bodyPart: 'abs' })]);
      expect(results.map((r) => r.status).sort((a, b) => a - b)).toEqual([201, 409]);
    });
  });

  // マイグレーションが入れる一覧の種目と、表の制約（DB を直接見る）
  describe('表の制約（DB を直接検査）', () => {
    // 制約に違反する INSERT を試し、必ず ROLLBACK で元に戻す（一覧の種目を汚さない）
    const rejected = (sql: string, params: unknown[] = []) =>
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

    it('お試し値は、重量と回数のどちらか片方だけは入れられない（CHECK 違反 23514）', async () => {
      expect(await rejected(`INSERT INTO exercises (name, body_part, trial_weight_kg) VALUES ('片方だけ', 'abs', 5)`)).toBe('23514');
      expect(await rejected(`INSERT INTO exercises (name, body_part, trial_reps) VALUES ('片方だけ', 'abs', 5)`)).toBe('23514');
    });

    it('一覧の種目の同名は、大文字小文字を区別せず入れられない（一意違反 23505）', async () => {
      // 一覧の種目の1件と同じ名前・部位の行を、もう1行入れようとする
      expect(await rejected('INSERT INTO exercises (name, body_part) SELECT name, body_part FROM exercises WHERE id = $1', [BENCH_PRESS_ID])).toBe('23505');
      await withPool(url!, async (pool) => {
        await pool.query('BEGIN');
        try {
          await pool.query(`INSERT INTO exercises (name, body_part) VALUES ('Plank', 'abs')`);
          await expect(pool.query(`INSERT INTO exercises (name, body_part) VALUES ('plank', 'abs')`)).rejects.toMatchObject({ code: '23505' });
        } finally {
          await pool.query('ROLLBACK');
        }
      });
    });

    it('マイグレーションを2回流しても、一覧の種目は30件のまま', async () => {
      await migrateDb(process.env.MIGRATION_DATABASE_URL ?? url!);
      const count = await withPool(url!, async (pool) => (await pool.query('SELECT count(*)::int AS n FROM exercises WHERE created_by IS NULL')).rows[0].n);
      expect(count).toBe(COMMON_TOTAL);
    });

    it('resetDb のあとも、一覧の種目30件が残る（users を空にしても巻き込まれない）', async () => {
      await resetDb(url!);
      const count = await withPool(url!, async (pool) => (await pool.query('SELECT count(*)::int AS n FROM exercises')).rows[0].n);
      expect(count).toBe(COMMON_TOTAL);
    });
  });
});
