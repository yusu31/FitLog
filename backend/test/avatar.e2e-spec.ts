import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createApp, migrateDb, resetDb, TEST_ORIGIN, withPool } from './helpers/app.js';

// キャラの編集（F-32）。自分のキャラの読み書き。本物の PostgreSQL・本物の better-auth。
// DATABASE_URL が無ければ「落ちる」（飛ばさない）
const url = process.env.DATABASE_URL;

const cookieOf = (res: request.Response): string =>
  (res.headers['set-cookie'] as unknown as string[]).map((c) => c.split(';')[0]).join('; ');

const DEFAULT = { body: 'A', hair: 1, hairColor: 'brown', shirtColor: 'teal', pantsColor: 'navy', accessory: 'none' };
const CHANGED = { body: 'B', hair: 3, hairColor: 'blonde', shirtColor: 'coral', pantsColor: 'khaki', accessory: 'glasses' };

describe('キャラの編集（結合: 本物の PostgreSQL・better-auth）', () => {
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
  const signUp = async (): Promise<{ cookie: string; id: string }> => {
    const res = await http()
      .post('/api/auth/sign-up/email')
      .set('Origin', TEST_ORIGIN)
      .send({ email: `av${++userSeq}@example.com`, password: 'correct-horse-battery', name: `キャラ${userSeq}` })
      .expect(200);
    return { cookie: cookieOf(res), id: (res.body as { user: { id: string } }).user.id };
  };

  it('T-AVATAR-00 ログインしていないと 401', async () => {
    await http().get('/api/avatar').expect(401);
    await http().put('/api/avatar').send(CHANGED).expect(401);
  });

  it('T-AVATAR-01 登録したばかりの人は、既定のキャラ（小物なし）', async () => {
    const me = await signUp();
    expect((await http().get('/api/avatar').set('Cookie', me.cookie).expect(200)).body).toEqual(DEFAULT);
  });

  it('T-AVATAR-02 保存すると読める。置き換えなので、小物を省くと none に戻る', async () => {
    const me = await signUp();
    expect((await http().put('/api/avatar').set('Cookie', me.cookie).send(CHANGED).expect(200)).body).toEqual(CHANGED);
    expect((await http().get('/api/avatar').set('Cookie', me.cookie).expect(200)).body).toEqual(CHANGED);
    const { accessory: _omit, ...withoutAccessory } = CHANGED;
    expect((await http().put('/api/avatar').set('Cookie', me.cookie).send(withoutAccessory).expect(200)).body).toMatchObject({ accessory: 'none', hair: 3 });
  });

  it('T-AVATAR-03 選べない値・足りない項目は 400（VALIDATION_ERROR）で、保存されない', async () => {
    const me = await signUp();
    for (const bad of [{ ...CHANGED, hairColor: 'pink' }, { ...CHANGED, hair: 9 }, { ...CHANGED, accessory: '../x' }, { body: 'A' }, {}]) {
      const res = await http().put('/api/avatar').set('Cookie', me.cookie).send(bad).expect(400);
      expect(res.body).toMatchObject({ code: 'VALIDATION_ERROR' });
    }
    expect((await http().get('/api/avatar').set('Cookie', me.cookie).expect(200)).body).toEqual(DEFAULT);
  });

  it('T-AVATAR-04 人のキャラは変わらない（自分の行だけ書く）', async () => {
    const a = await signUp();
    const b = await signUp();
    await http().put('/api/avatar').set('Cookie', a.cookie).send(CHANGED).expect(200);
    expect((await http().get('/api/avatar').set('Cookie', b.cookie).expect(200)).body).toEqual(DEFAULT);
  });

  it('T-AVATAR-05 古い行（小物の項目が無い）も読める。小物は none として返る', async () => {
    const me = await signUp();
    await http().put('/api/avatar').set('Cookie', me.cookie).send(CHANGED).expect(200);
    // 小物が無かった頃の形に戻す（DB を直接書き換える）
    await withPool(url!, (pool) => pool.query(`UPDATE users SET avatar = '{"body":"A","hair":1,"hairColor":"brown","shirtColor":"teal","pantsColor":"navy"}'::jsonb WHERE id = $1`, [me.id]));
    expect((await http().get('/api/avatar').set('Cookie', me.cookie).expect(200)).body).toEqual(DEFAULT);
  });
});
