import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createApp, migrateDb, resetDb, TEST_ORIGIN, withPool } from './helpers/app.js';

// セットを足す（POST /records/{id}/sets）の結合テスト（本物の PostgreSQL・本物の better-auth）。DATABASE_URL が無ければ「落ちる」（飛ばさない）。
const url = process.env.DATABASE_URL;

const cookieOf = (res: request.Response): string =>
  (res.headers['set-cookie'] as unknown as string[]).map((c) => c.split(';')[0]).join('; ');

// 一覧の種目は固定の ID で入っている（名前で探さず ID の定数で指す。docs/testing-design.md 7-1）
const BENCH_PRESS_ID = '00000000-0000-4000-8000-000000000001';
const SQUAT_ID = '00000000-0000-4000-8000-000000000024';
const RECORDED_AT = '2026-10-26T03:00:00.000Z';

type SetRow = { id: string; record_id: string; exercise_id: string; set_no: number; weight_kg: string; reps: number };

describe('セットを足す（結合: 本物の PostgreSQL・better-auth）', () => {
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

  const createRecord = async (cookie: string, kind: 'workout' | 'rest' = 'workout', recordedAt = RECORDED_AT): Promise<string> => {
    const id = randomUUID();
    await request(app.getHttpServer()).post('/api/records').set('Cookie', cookie).send({ id, kind, recordedAt }).expect(201);
    return id;
  };

  const set = (id = randomUUID(), override: Record<string, unknown> = {}) => ({ id, exerciseId: BENCH_PRESS_ID, setNo: 1, weightKg: 40, reps: 10, ...override });
  const addSet = (cookie: string, recordId: string, body: unknown) =>
    request(app.getHttpServer()).post(`/api/records/${recordId}/sets`).set('Cookie', cookie).send(body as object);

  const setRows = (): Promise<SetRow[]> =>
    withPool(url!, async (pool) => (await pool.query('SELECT id, record_id, exercise_id, set_no, weight_kg::text AS weight_kg, reps FROM workout_sets ORDER BY created_at, id')).rows);

  it('Cookie なしでは 401', async () => {
    await request(app.getHttpServer()).post(`/api/records/${randomUUID()}/sets`).send(set()).expect(401);
  });

  describe('セットを足す（201）', () => {
    // T-SET-01
    it('代表的な値（40kg×10）は 201。id・setNo・weightKg・reps・result・isPersonalBest を返し、DB に1行入る', async () => {
      const cookie = await signUpAs('たろう');
      const recordId = await createRecord(cookie);
      const body = set();
      const res = await addSet(cookie, recordId, body).expect(201);

      // 前回が無い・初めての記録なので、result は null・札は付かない（ゴーストの細かい判定は ghost.e2e-spec.ts）
      expect(res.body).toEqual({ id: body.id, setNo: 1, weightKg: 40, reps: 10, result: null, isPersonalBest: false });
      expect(await setRows()).toEqual([{ id: body.id, record_id: recordId, exercise_id: BENCH_PRESS_ID, set_no: 1, weight_kg: '40.0', reps: 10 }]);
    });

    // T-SET-02・04・06・08・10（結）: 下端・上端の値が DB の列（numeric(4,1)・smallint）に収まる
    it.each<[string, number, number]>([
      ['T-SET-02 重量の下端 0（自重の種目）', 0, 10],
      ['T-SET-04 最小の刻み 0.5', 0.5, 10],
      ['T-SET-06 重量の上端 500', 500, 10],
      ['T-SET-08 回数の下端 1', 40, 1],
      ['T-SET-10 回数の上端 999', 40, 999],
    ])('%s は 201', async (_name, weightKg, reps) => {
      const cookie = await signUpAs('たろう');
      const recordId = await createRecord(cookie);
      const res = await addSet(cookie, recordId, set(randomUUID(), { weightKg, reps })).expect(201);
      expect(res.body).toMatchObject({ weightKg, reps });
    });

    it('同じ記録に、同じ種目の2セット目・別の種目の1セット目を足せる', async () => {
      const cookie = await signUpAs('たろう');
      const recordId = await createRecord(cookie);
      await addSet(cookie, recordId, set(randomUUID(), { setNo: 1 })).expect(201);
      await addSet(cookie, recordId, set(randomUUID(), { setNo: 2 })).expect(201);
      await addSet(cookie, recordId, set(randomUUID(), { exerciseId: SQUAT_ID, setNo: 1 })).expect(201);
      expect(await setRows()).toHaveLength(3);
    });

    it('同じセット番号でも、別の記録なら足せる（一意なのは記録ごと・種目ごと）', async () => {
      const cookie = await signUpAs('たろう');
      const a = await createRecord(cookie, 'workout', '2026-10-26T03:00:00.000Z');
      const b = await createRecord(cookie, 'workout', '2026-10-27T03:00:00.000Z');
      await addSet(cookie, a, set()).expect(201);
      await addSet(cookie, b, set()).expect(201);
      expect(await setRows()).toHaveLength(2);
    });
  });

  describe('入力の検査（400）', () => {
    // T-SET-03・05・07・09・11・12・13 は単体（set-input.spec.ts）。ここは API が 400 を返し、DB に入らないことの代表
    it('範囲の外・刻みの途中・数でない値は 400。応答に項目ごとの理由が入り、DB に入らない', async () => {
      const cookie = await signUpAs('たろう');
      const recordId = await createRecord(cookie);
      const res = await addSet(cookie, recordId, set(randomUUID(), { weightKg: 500.5, reps: 0 })).expect(400);
      expect(res.body).toMatchObject({ code: 'VALIDATION_ERROR' });
      expect(res.body.details).toHaveLength(2);
      await addSet(cookie, recordId, set(randomUUID(), { weightKg: 0.25 })).expect(400);
      await addSet(cookie, recordId, set(randomUUID(), { weightKg: 'abc' })).expect(400);
      await addSet(cookie, recordId, {}).expect(400);
      expect(await setRows()).toHaveLength(0);
    });

    it('URL の記録の id が UUID でないときは 404（DB のエラー 500 にしない）', async () => {
      const cookie = await signUpAs('たろう');
      await addSet(cookie, 'not-a-uuid', set()).expect(404);
    });
  });

  describe('親の記録・種目の確認', () => {
    // T-OFF-05
    it('記録の作成より先にセットが届くと 404（記録がまだ無い）。DB に入らない', async () => {
      const cookie = await signUpAs('たろう');
      const res = await addSet(cookie, randomUUID(), set()).expect(404);
      expect(res.body).toMatchObject({ code: 'RECORD_NOT_FOUND' });
      expect(await setRows()).toHaveLength(0);
    });

    // T-SET-15・T-OFF-14（親）
    it('他の人の記録にセットを足すと 404（存在を教えない）。DB に入らない', async () => {
      const taro = await signUpAs('たろう');
      const hanako = await signUpAs('はなこ');
      const recordId = await createRecord(taro);

      const res = await addSet(hanako, recordId, set()).expect(404);
      expect(res.body).toMatchObject({ code: 'RECORD_NOT_FOUND' });
      expect(await setRows()).toHaveLength(0);
    });

    // T-SET-16
    it('休みの記録にセットを足すと 409 RECORD_KIND_MISMATCH', async () => {
      const cookie = await signUpAs('たろう');
      const recordId = await createRecord(cookie, 'rest');
      const res = await addSet(cookie, recordId, set()).expect(409);
      expect(res.body).toMatchObject({ code: 'RECORD_KIND_MISMATCH' });
      expect(await setRows()).toHaveLength(0);
    });

    it('ランの記録にセットを足すと 409 RECORD_KIND_MISMATCH（ランの作成 API はまだ無いので、DB に直接入れる）', async () => {
      const cookie = await signUpAs('たろう');
      const recordId = randomUUID();
      await withPool(url!, (pool) =>
        pool.query(`INSERT INTO records (id, user_id, kind, recorded_at, local_date) SELECT $1, id, 'run', now(), current_date FROM users WHERE name = 'たろう'`, [recordId]),
      );
      const res = await addSet(cookie, recordId, set()).expect(409);
      expect(res.body).toMatchObject({ code: 'RECORD_KIND_MISMATCH' });
    });

    it('存在しない種目の id は 404 EXERCISE_NOT_FOUND', async () => {
      const cookie = await signUpAs('たろう');
      const recordId = await createRecord(cookie);
      const res = await addSet(cookie, recordId, set(randomUUID(), { exerciseId: randomUUID() })).expect(404);
      expect(res.body).toMatchObject({ code: 'EXERCISE_NOT_FOUND' });
      expect(await setRows()).toHaveLength(0);
    });

    // T-EXR-05
    it('他の人が追加した種目の id は 404（見えない）。自分で追加した種目なら 201', async () => {
      const taro = await signUpAs('たろう');
      const hanako = await signUpAs('はなこ');
      const yoga = await request(app.getHttpServer()).post('/api/exercises').set('Cookie', taro).send({ name: 'ヨガ', bodyPart: 'abs' }).expect(201);
      const taroRecord = await createRecord(taro);
      const hanakoRecord = await createRecord(hanako);

      await addSet(taro, taroRecord, set(randomUUID(), { exerciseId: yoga.body.id })).expect(201);
      const res = await addSet(hanako, hanakoRecord, set(randomUUID(), { exerciseId: yoga.body.id })).expect(404);
      expect(res.body).toMatchObject({ code: 'EXERCISE_NOT_FOUND' });
    });
  });

  describe('冪等と二重登録', () => {
    // T-OFF-02
    it('同じ id を2回送ると 201 → 200 で、DB は1行。2回目の応答は1回目と同じ', async () => {
      const cookie = await signUpAs('たろう');
      const recordId = await createRecord(cookie);
      const body = set();
      const first = await addSet(cookie, recordId, body).expect(201);
      const second = await addSet(cookie, recordId, body).expect(200);

      expect(second.body).toEqual(first.body);
      expect(await setRows()).toHaveLength(1);
    });

    // T-OFF-03
    it('同じ id で中身（重量・回数）を変えて送ると、1回目の内容が残り、2回目の応答も1回目の内容', async () => {
      const cookie = await signUpAs('たろう');
      const recordId = await createRecord(cookie);
      const id = randomUUID();
      const first = await addSet(cookie, recordId, set(id)).expect(201);
      const second = await addSet(cookie, recordId, set(id, { weightKg: 100, reps: 3 })).expect(200);

      expect(second.body).toEqual(first.body);
      expect(await setRows()).toEqual([expect.objectContaining({ id, weight_kg: '40.0', reps: 10 })]);
    });

    // T-OFF-14（セット自身の id が他人のセットとぶつかる）
    it('他の人のセットと同じ id を、自分の記録に送ると 404。元の行は変わらない', async () => {
      const taro = await signUpAs('たろう');
      const hanako = await signUpAs('はなこ');
      const taroRecord = await createRecord(taro);
      const hanakoRecord = await createRecord(hanako);
      const id = randomUUID();
      await addSet(taro, taroRecord, set(id)).expect(201);

      const res = await addSet(hanako, hanakoRecord, set(id, { weightKg: 100 })).expect(404);
      expect(res.body).not.toHaveProperty('weightKg');
      expect(await setRows()).toEqual([expect.objectContaining({ id, record_id: taroRecord, weight_kg: '40.0' })]);
    });

    // T-SET-14
    it('同じセット番号を別の id で2回送ると、2回目は 409 SET_NUMBER_TAKEN。1回目の内容が残る', async () => {
      const cookie = await signUpAs('たろう');
      const recordId = await createRecord(cookie);
      await addSet(cookie, recordId, set(randomUUID(), { setNo: 2, weightKg: 40 })).expect(201);

      const res = await addSet(cookie, recordId, set(randomUUID(), { setNo: 2, weightKg: 50 })).expect(409);
      expect(res.body).toMatchObject({ code: 'SET_NUMBER_TAKEN' });
      expect(await setRows()).toEqual([expect.objectContaining({ set_no: 2, weight_kg: '40.0' })]);
    });

    it('同時に同じ id を2つ送っても、1行で、どちらも成功する（201 と 200）', async () => {
      const cookie = await signUpAs('たろう');
      const recordId = await createRecord(cookie);
      const body = set();
      const results = await Promise.all([addSet(cookie, recordId, body), addSet(cookie, recordId, body)]);

      expect(results.map((r) => r.status).sort((a, b) => a - b)).toEqual([200, 201]);
      expect(results[0].body).toEqual(results[1].body);
      expect(await setRows()).toHaveLength(1);
    });

    it('同時に同じセット番号を別の id で2つ送ると、1件が 201・もう1件が 409', async () => {
      const cookie = await signUpAs('たろう');
      const recordId = await createRecord(cookie);
      const results = await Promise.all([addSet(cookie, recordId, set()), addSet(cookie, recordId, set())]);

      expect(results.map((r) => r.status).sort((a, b) => a - b)).toEqual([201, 409]);
      expect(await setRows()).toHaveLength(1);
    });
  });

  // 表の制約（DB を直接検査）。API の検査をすり抜けても、DB が最後の砦になる
  describe('表の制約（DB を直接検査）', () => {
    // 制約に違反する INSERT を試し、必ず ROLLBACK で元に戻す
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

    const insertSet = (recordId: string, overrides: { weight?: number; reps?: number; setNo?: number; exerciseId?: string } = {}) =>
      rejected('INSERT INTO workout_sets (id, record_id, exercise_id, set_no, weight_kg, reps) VALUES ($1, $2, $3, $4, $5, $6)', [
        randomUUID(),
        recordId,
        overrides.exerciseId ?? BENCH_PRESS_ID,
        overrides.setNo ?? 1,
        overrides.weight ?? 40,
        overrides.reps ?? 10,
      ]);

    it('重量・回数・セット番号の範囲の外は入れられない（CHECK 違反 23514）', async () => {
      const cookie = await signUpAs('たろう');
      const recordId = await createRecord(cookie);

      expect(await insertSet(recordId, { weight: -0.5 })).toBe('23514');
      expect(await insertSet(recordId, { weight: 500.5 })).toBe('23514');
      expect(await insertSet(recordId, { weight: 0.1 })).toBe('23514');
      expect(await insertSet(recordId, { reps: 0 })).toBe('23514');
      expect(await insertSet(recordId, { reps: 1000 })).toBe('23514');
      expect(await insertSet(recordId, { setNo: 0 })).toBe('23514');
    });

    it('範囲の端の値（重量 0・500・回数 1・999）は入れられる', async () => {
      const cookie = await signUpAs('たろう');
      const recordId = await createRecord(cookie);

      expect(await insertSet(recordId, { weight: 0, reps: 1 })).toBeUndefined();
      expect(await insertSet(recordId, { weight: 500, reps: 999 })).toBeUndefined();
    });

    it('存在しない記録・種目を指すセットは入れられない（参照制約違反 23503）', async () => {
      const cookie = await signUpAs('たろう');
      const recordId = await createRecord(cookie);

      expect(await insertSet(randomUUID())).toBe('23503');
      expect(await insertSet(recordId, { exerciseId: randomUUID() })).toBe('23503');
    });

    it('記録を消すと、その記録のセットも一緒に消える（ON DELETE CASCADE）', async () => {
      const cookie = await signUpAs('たろう');
      const recordId = await createRecord(cookie);
      await addSet(cookie, recordId, set(randomUUID(), { setNo: 1 })).expect(201);
      await addSet(cookie, recordId, set(randomUUID(), { setNo: 2 })).expect(201);

      await withPool(url!, (pool) => pool.query('DELETE FROM records WHERE id = $1', [recordId]));
      expect(await setRows()).toHaveLength(0);
    });

    it('使われている種目は消せない（セットが指しているので、参照制約違反 23503）', async () => {
      const cookie = await signUpAs('たろう');
      const recordId = await createRecord(cookie);
      await addSet(cookie, recordId, set()).expect(201);

      expect(await rejected('DELETE FROM exercises WHERE id = $1', [BENCH_PRESS_ID])).toBe('23503');
    });
  });
});
