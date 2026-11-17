import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createApp, migrateDb, resetDb, TEST_ORIGIN, withPool } from './helpers/app.js';

// ルーティン（F3）。GET /routines・POST /routines・DELETE /routines/{id} の結合テスト。
// 自分の筋トレの記録1件から、種目と回数・重さを写して保存する。1人5件まで・名前は1〜20字・同じ名前は不可。
// 本物の PostgreSQL・本物の better-auth。DATABASE_URL が無ければ「落ちる」（飛ばさない）
const url = process.env.DATABASE_URL;

const cookieOf = (res: request.Response): string =>
  (res.headers['set-cookie'] as unknown as string[]).map((c) => c.split(';')[0]).join('; ');

const BENCH_PRESS_ID = '00000000-0000-4000-8000-000000000001';
const SQUAT_ID = '00000000-0000-4000-8000-000000000024';
const NOON = '2026-10-26T03:00:00.000Z';

type Routine = { id: string; name: string; exercises: Array<{ exerciseId: string; name: string; bodyPart: string; sets: Array<{ setNo: number; weightKg: number; reps: number }> }> };

describe('ルーティン（結合: 本物の PostgreSQL・better-auth）', () => {
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
  const signUp = async (): Promise<string> => {
    const res = await http()
      .post('/api/auth/sign-up/email')
      .set('Origin', TEST_ORIGIN)
      .send({ email: `rt${++userSeq}@example.com`, password: 'correct-horse-battery', name: `ユーザー${userSeq}` })
      .expect(200);
    return cookieOf(res);
  };

  // 筋トレの記録を作り、[種目, 重量, 回数] の順にセットを入れる（セット番号は種目ごとに1から）
  const workout = async (cookie: string, sets: Array<[string, number, number]>): Promise<string> => {
    const id = randomUUID();
    await http().post('/api/records').set('Cookie', cookie).send({ id, kind: 'workout', recordedAt: NOON }).expect(201);
    const counts = new Map<string, number>();
    for (const [exerciseId, weightKg, reps] of sets) {
      const setNo = (counts.get(exerciseId) ?? 0) + 1;
      counts.set(exerciseId, setNo);
      await http().post(`/api/records/${id}/sets`).set('Cookie', cookie).send({ id: randomUUID(), exerciseId, setNo, weightKg, reps }).expect(201);
    }
    return id;
  };

  const save = (cookie: string, name: string, recordId: string) => http().post('/api/routines').set('Cookie', cookie).send({ name, recordId });
  const list = async (cookie: string) => (await http().get('/api/routines').set('Cookie', cookie).expect(200)).body as { items: Routine[]; max: number };

  it('記録の種目と回数・重さを写して保存し、一覧で返す。種目は最初にセットを足した順（T-ROUTINE-01）', async () => {
    const me = await signUp();
    const recordId = await workout(me, [
      [SQUAT_ID, 60, 10],
      [BENCH_PRESS_ID, 40, 12],
      [SQUAT_ID, 62.5, 8],
    ]);
    const res = await save(me, '  脚と胸  ', recordId).expect(201);
    expect((res.body as Routine).name).toBe('脚と胸');

    const { items, max } = await list(me);
    expect(max).toBe(5);
    expect(items).toHaveLength(1);
    expect(items[0].exercises.map((e) => [e.exerciseId, e.sets.map((s) => [s.setNo, s.weightKg, s.reps])])).toEqual([
      [SQUAT_ID, [[1, 60, 10], [2, 62.5, 8]]],
      [BENCH_PRESS_ID, [[1, 40, 12]]],
    ]);
  });

  it('元の記録を消しても、ルーティンは残る（T-ROUTINE-02）', async () => {
    const me = await signUp();
    const recordId = await workout(me, [[BENCH_PRESS_ID, 40, 10]]);
    await save(me, '胸', recordId).expect(201);
    await http().delete(`/api/records/${recordId}`).set('Cookie', me).expect(204);
    expect((await list(me)).items[0].exercises[0].sets).toEqual([{ setNo: 1, weightKg: 40, reps: 10 }]);
  });

  it('5件までは保存でき、6件目は 409 ROUTINE_LIMIT。1件消すとまた保存できる（T-ROUTINE-03・境界値）', async () => {
    const me = await signUp();
    const recordId = await workout(me, [[BENCH_PRESS_ID, 40, 10]]);
    const ids: string[] = [];
    for (let i = 1; i <= 5; i++) ids.push(((await save(me, `メニュー${i}`, recordId).expect(201)).body as Routine).id);
    expect((await save(me, 'メニュー6', recordId).expect(409)).body.code).toBe('ROUTINE_LIMIT');

    await http().delete(`/api/routines/${ids[0]}`).set('Cookie', me).expect(204);
    await save(me, 'メニュー6', recordId).expect(201);
    expect((await list(me)).items.map((r) => r.name)).toEqual(['メニュー2', 'メニュー3', 'メニュー4', 'メニュー5', 'メニュー6']);
  });

  // 同時押しの再現。API の接続は1本なので、API に2つ送っても順番に処理されて競合しない。
  // そこで「もう1台の端末」を別の DB 接続で演じる: 先に持ち主の users の行に共有ロック（FOR SHARE）をかけ、その間に API へ5件目を送る。
  // ・API が FOR UPDATE（専有ロック）を取る作りなら、共有ロックとぶつかって待つ → こちらが5件目を入れてコミットした後に数えるので 409
  // ・API がロックを取らない作りなら、待たずに 4件と数えて 201 になり、6件になる（このテストが落ちる。ロックを外して赤を確認済み）
  // もう1台は PgBouncer を通さず直接つなぐ（MIGRATION_DATABASE_URL）。PgBouncer は DB への線が1本（default_pool_size=1）なので、
  // 開いたままのトランザクションが線をふさぎ、ロックと関係なく API が待たされてしまう
  it('別の処理が数えている間は待ち、その結果を見てから数える。5件を超えない（T-ROUTINE-04・行ロック）', async () => {
    const me = await signUp();
    const recordId = await workout(me, [[BENCH_PRESS_ID, 40, 10]]);
    for (let i = 1; i <= 4; i++) await save(me, `メニュー${i}`, recordId).expect(201);
    const userId = (await http().get('/api/auth/get-session').set('Cookie', me).expect(200)).body.user.id as string;

    await withPool(process.env.MIGRATION_DATABASE_URL ?? url!, async (pool) => {
      const other = await pool.connect();
      try {
        await other.query('BEGIN');
        await other.query('SELECT id FROM users WHERE id = $1 FOR SHARE', [userId]);
        const pending = save(me, '同時A', recordId).then((r) => r);
        // API が待たされているあいだに、もう1台が5件目を入れる
        await new Promise((resolve) => setTimeout(resolve, 500));
        await other.query("INSERT INTO routines (user_id, name) VALUES ($1, '同時B')", [userId]);
        await other.query('COMMIT');
        const res = await pending;
        expect(res.status).toBe(409);
        expect(res.body.code).toBe('ROUTINE_LIMIT');
      } finally {
        other.release();
      }
    });
    expect((await list(me)).items).toHaveLength(5);
  });

  it('同じ名前（大文字小文字は区別しない）は 409 ROUTINE_NAME_TAKEN。別の人なら同じ名前でよい（T-ROUTINE-05）', async () => {
    const me = await signUp();
    const other = await signUp();
    await save(me, 'Leg Day', await workout(me, [[SQUAT_ID, 60, 10]])).expect(201);
    expect((await save(me, 'leg day', await workout(me, [[SQUAT_ID, 60, 10]])).expect(409)).body.code).toBe('ROUTINE_NAME_TAKEN');
    await save(other, 'Leg Day', await workout(other, [[SQUAT_ID, 50, 10]])).expect(201);
  });

  it('他の人の記録・セットの無い記録・ランの記録からは作れない（T-ROUTINE-06）', async () => {
    const me = await signUp();
    const other = await signUp();
    const othersRecord = await workout(other, [[BENCH_PRESS_ID, 40, 10]]);
    expect((await save(me, '盗む', othersRecord).expect(404)).body.code).toBe('RECORD_NOT_FOUND');

    const empty = await workout(me, []);
    expect((await save(me, '空', empty).expect(409)).body.code).toBe('ROUTINE_EMPTY');

    const runId = randomUUID();
    await http().post('/api/records').set('Cookie', me).send({ id: runId, kind: 'run', recordedAt: NOON, run: { distanceM: 5000, durationS: 1800 } }).expect(201);
    expect((await save(me, 'ラン', runId).expect(409)).body.code).toBe('RECORD_KIND_MISMATCH');
    expect((await list(me)).items).toEqual([]);
  });

  it('名前が21字・空白だけは 400 VALIDATION_ERROR（T-ROUTINE-07）', async () => {
    const me = await signUp();
    const recordId = await workout(me, [[BENCH_PRESS_ID, 40, 10]]);
    expect((await save(me, 'あ'.repeat(21), recordId).expect(400)).body.code).toBe('VALIDATION_ERROR');
    await save(me, '   ', recordId).expect(400);
    await save(me, 'あ'.repeat(20), recordId).expect(201);
  });

  it('他の人のルーティンは見えず、消せない（404 ROUTINE_NOT_FOUND）（T-ROUTINE-08）', async () => {
    const me = await signUp();
    const other = await signUp();
    const { id } = (await save(other, '胸', await workout(other, [[BENCH_PRESS_ID, 40, 10]])).expect(201)).body as Routine;
    expect((await list(me)).items).toEqual([]);
    expect((await http().delete(`/api/routines/${id}`).set('Cookie', me).expect(404)).body.code).toBe('ROUTINE_NOT_FOUND');
    await http().delete('/api/routines/not-a-uuid').set('Cookie', me).expect(404);
    expect((await list(other)).items).toHaveLength(1);
  });

  it('ログインしていなければ 401（T-ROUTINE-09）', async () => {
    await http().get('/api/routines').expect(401);
  });
});
