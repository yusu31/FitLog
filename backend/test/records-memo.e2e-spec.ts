import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createApp, migrateDb, resetDb, TEST_ORIGIN, withPool } from './helpers/app.js';

// 記録のメモ・きつさ（F5。PATCH /records/{id}/memo）の結合テスト。本物の PostgreSQL・better-auth。
// 持ち主だけが書き・読める（同じグループの仲間の詳細には返さない）
const url = process.env.DATABASE_URL;
const MON_NOON = '2026-10-26T03:00:00.000Z';

const cookieOf = (res: request.Response): string =>
  (res.headers['set-cookie'] as unknown as string[]).map((c) => c.split(';')[0]).join('; ');

describe('記録のメモ・きつさ（結合: 本物の PostgreSQL・better-auth）', () => {
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
  let seq = 0;
  const signUpAs = async (name: string): Promise<string> =>
    cookieOf(
      await http().post('/api/auth/sign-up/email').set('Origin', TEST_ORIGIN).send({ email: `memo${++seq}@example.com`, password: 'correct-horse-battery', name }).expect(200),
    );
  const createRecord = async (cookie: string): Promise<string> => {
    const id = randomUUID();
    await http().post('/api/records').set('Cookie', cookie).send({ id, kind: 'workout', recordedAt: MON_NOON }).expect(201);
    return id;
  };
  const patch = (cookie: string, id: string, body: unknown) => http().patch(`/api/records/${id}/memo`).set('Cookie', cookie).send(body as object);
  const detail = async (cookie: string, id: string) => (await http().get(`/api/records/${id}`).set('Cookie', cookie).expect(200)).body as { note?: string; rpe?: number };

  it('メモときつさを保存でき、詳細に返る。null で消せ、片方だけの更新はもう片方を触らない', async () => {
    const me = await signUpAs('じぶん');
    const id = await createRecord(me);
    expect(await detail(me, id)).not.toHaveProperty('note');

    await patch(me, id, { note: '肩が重かった', rpe: 8 }).expect(200, { note: '肩が重かった', rpe: 8, caption: null });
    expect(await detail(me, id)).toMatchObject({ note: '肩が重かった', rpe: 8 });

    await patch(me, id, { rpe: 6 }).expect(200);
    expect(await detail(me, id)).toMatchObject({ note: '肩が重かった', rpe: 6 });

    await patch(me, id, { note: null, rpe: null }).expect(200);
    const cleared = await detail(me, id);
    expect(cleared).not.toHaveProperty('note');
    expect(cleared).not.toHaveProperty('rpe');
  });

  it('境界: きつさ 0・11・小数、メモ 201 字は 400 で、何も変わらない。10 と 200 字は通る', async () => {
    const me = await signUpAs('じぶん');
    const id = await createRecord(me);
    for (const body of [{ rpe: 0 }, { rpe: 11 }, { rpe: 1.5 }, { note: 'あ'.repeat(201) }, {}]) {
      expect((await patch(me, id, body)).status).toBe(400);
    }
    expect(await detail(me, id)).not.toHaveProperty('rpe');
    await patch(me, id, { rpe: 10, note: 'あ'.repeat(200) }).expect(200);
  });

  it('他の人の記録・無い id は 404（存在を教えない）。仲間の詳細にメモ・きつさは出ない', async () => {
    const me = await signUpAs('じぶん');
    await http().post('/api/groups').set('Cookie', me).send({ name: '朝トレ部' }).expect(201);
    const { token } = (await http().post('/api/groups/current/invitations').set('Cookie', me).expect(201)).body as { token: string };
    const friend = await signUpAs('ともだち');
    await http().post(`/api/invitations/${token}/accept`).set('Cookie', friend).expect(200);
    const id = await createRecord(me);
    await patch(me, id, { note: 'ひみつ', rpe: 9 }).expect(200);

    // 仲間は見られるが、メモ・きつさは返らない
    const seen = await detail(friend, id);
    expect(seen).not.toHaveProperty('note');
    expect(seen).not.toHaveProperty('rpe');
    // 仲間は書けない。無い id も同じ 404
    await patch(friend, id, { note: 'のっとり' }).expect(404);
    await patch(me, randomUUID(), { rpe: 5 }).expect(404);
    const stored = await withPool(url!, async (pool) => (await pool.query('SELECT note, rpe FROM records WHERE id = $1', [id])).rows[0]);
    expect(stored).toEqual({ note: 'ひみつ', rpe: 9 });
  });

  it('ログインしていなければ 401', async () => {
    await http().patch(`/api/records/${randomUUID()}/memo`).send({ rpe: 5 }).expect(401);
  });
});
