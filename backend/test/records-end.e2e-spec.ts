import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createApp, migrateDb, resetDb, TEST_ORIGIN, withPool } from './helpers/app.js';

// 筋トレの終了（POST /records/{id}/end）と「いま記録中」（詳細・一覧の active）の結合テスト（N1・N2）。
// 本物の PostgreSQL・本物の better-auth。DATABASE_URL が無ければ「落ちる」（飛ばさない）。
const url = process.env.DATABASE_URL;

const cookieOf = (res: request.Response): string =>
  (res.headers['set-cookie'] as unknown as string[]).map((c) => c.split(';')[0]).join('; ');

const BENCH_PRESS_ID = '00000000-0000-4000-8000-000000000001';

describe('筋トレの終了と記録中（結合: 本物の PostgreSQL・better-auth）', () => {
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
      .send({ email: `end${++userSeq}@example.com`, password: 'correct-horse-battery', name })
      .expect(200);
    return cookieOf(res);
  };

  const createRecord = async (cookie: string, kind: 'workout' | 'run' = 'workout'): Promise<string> => {
    const id = randomUUID();
    const body = kind === 'run' ? { id, kind, recordedAt: new Date().toISOString(), run: { distanceM: 5000, durationS: 1800 } } : { id, kind, recordedAt: new Date().toISOString() };
    await http().post('/api/records').set('Cookie', cookie).send(body).expect(201);
    return id;
  };

  const addSet = async (cookie: string, recordId: string, setNo: number): Promise<void> => {
    await http().post(`/api/records/${recordId}/sets`).set('Cookie', cookie).send({ id: randomUUID(), exerciseId: BENCH_PRESS_ID, setNo, weightKg: 40, reps: 10 }).expect(201);
  };

  const detail = async (cookie: string, id: string) => (await http().get(`/api/records/${id}`).set('Cookie', cookie).expect(200)).body;
  const end = (cookie: string | undefined, id: string) => {
    const r = http().post(`/api/records/${id}/end`);
    return cookie ? r.set('Cookie', cookie) : r;
  };

  it('Cookie なしでは 401', async () => {
    await end(undefined, randomUUID()).expect(401);
  });

  it('T-END-01 セットを足した直後の筋トレは記録中（active: true）で、endedAt は付かない。セットには時刻が付く', async () => {
    const cookie = await signUpAs('たろう');
    const id = await createRecord(cookie);
    await addSet(cookie, id, 1);
    const body = await detail(cookie, id);
    expect(body.active).toBe(true);
    expect(body.endedAt).toBeUndefined();
    expect(body.exercises[0].sets[0].createdAt).toEqual(expect.any(String));
  });

  it('T-END-02 「今日はここまで」で 200・endedAt が入り、そのあと記録中ではなくなる（一覧でも同じ）', async () => {
    const cookie = await signUpAs('たろう');
    const id = await createRecord(cookie);
    await addSet(cookie, id, 1);
    const res = await end(cookie, id).expect(200);
    expect(res.body.id).toBe(id);
    expect(res.body.endedAt).toEqual(expect.any(String));
    const body = await detail(cookie, id);
    expect(body.active).toBe(false);
    expect(body.endedAt).toBe(res.body.endedAt);
    const list = (await http().get('/api/records').set('Cookie', cookie).expect(200)).body;
    expect(list.items[0].active).toBe(false);
  });

  it('T-END-03 冪等: 2回押しても1回目の終了時刻のまま', async () => {
    const cookie = await signUpAs('たろう');
    const id = await createRecord(cookie);
    const first = (await end(cookie, id).expect(200)).body.endedAt;
    const second = (await end(cookie, id).expect(200)).body.endedAt;
    expect(second).toBe(first);
  });

  it('T-END-04 最後のセットから3時間以上たった筋トレは、終了を押さなくても記録中ではない（サーバーが読み出すときに判定）', async () => {
    const cookie = await signUpAs('たろう');
    const id = await createRecord(cookie);
    await addSet(cookie, id, 1);
    expect((await detail(cookie, id)).active).toBe(true);
    await withPool(url!, async (pool) => {
      await pool.query(`UPDATE workout_sets SET created_at = now() - interval '3 hours 1 minute' WHERE record_id = $1`, [id]);
      await pool.query(`UPDATE records SET recorded_at = now() - interval '4 hours' WHERE id = $1`, [id]);
    });
    const body = await detail(cookie, id);
    expect(body.active).toBe(false);
    expect(body.endedAt).toBeUndefined();
  });

  it('T-END-05 他の人の記録・無い id・UUID でない id は、同じ 404（存在を教えない）', async () => {
    const owner = await signUpAs('おや');
    const other = await signUpAs('ほか');
    const id = await createRecord(owner);
    await end(other, id).expect(404);
    await end(owner, randomUUID()).expect(404);
    await end(owner, 'not-a-uuid').expect(404);
    expect((await detail(owner, id)).endedAt).toBeUndefined();
  });

  it('T-END-06 筋トレでない記録（ラン）は 409 RECORD_KIND_MISMATCH', async () => {
    const cookie = await signUpAs('たろう');
    const id = await createRecord(cookie, 'run');
    const res = await end(cookie, id).expect(409);
    expect(res.body.code).toBe('RECORD_KIND_MISMATCH');
  });

  it('T-END-07 ランの詳細には active が付かない', async () => {
    const cookie = await signUpAs('たろう');
    const id = await createRecord(cookie, 'run');
    expect((await detail(cookie, id)).active).toBeUndefined();
  });
});
