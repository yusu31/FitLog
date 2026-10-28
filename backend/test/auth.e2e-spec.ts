import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createApp, migrateDb, TEST_ORIGIN, withPool } from './helpers/app.js';

// 認証の結合テスト（本物の PostgreSQL・本物の better-auth）。DATABASE_URL が無ければ「落ちる」（飛ばさない）。
const url = process.env.DATABASE_URL;
const PROTECTED = '/api/health/db'; // ログイン必須の道（design.md 2章: /health だけが例外）
const credentials = { email: 'taro@example.com', password: 'correct-horse-battery', name: 'たろう' };

// Set-Cookie から、次のリクエストに付ける「名前=値」だけを取り出す
const cookieOf = (res: request.Response): string =>
  (res.headers['set-cookie'] as unknown as string[]).map((c) => c.split(';')[0]).join('; ');

describe('認証（結合: 本物の PostgreSQL・better-auth）', () => {
  let app: INestApplication;

  beforeAll(async () => {
    if (!url) throw new Error('DATABASE_URL が設定されていません');
    await migrateDb(url);
  });

  beforeEach(async () => {
    await withPool(url!, (pool) => pool.query('TRUNCATE users CASCADE'));
    app = await createApp(url);
  });

  afterEach(async () => {
    await app?.close();
  });

  const signUp = (body = credentials) =>
    request(app.getHttpServer()).post('/api/auth/sign-up/email').set('Origin', TEST_ORIGIN).send(body);

  // T-AUTH-01: 既定で拒否。Cookie なしでは、ログイン必須の道は 401
  it('Cookie なしでログイン必須の道を呼ぶと 401', async () => {
    await request(app.getHttpServer()).get(PROTECTED).expect(401);
  });

  // T-AUTH-02: ログイン不要の例外。Cookie なしで /health は 200
  it('Cookie なしで GET /api/health は 200（ログイン不要の例外）', async () => {
    await request(app.getHttpServer()).get('/api/health').expect(200, { status: 'ok' });
  });

  // T-AUTH-03: 登録 → そのままログイン済み → ログイン必須の道が通る。Cookie の属性（HttpOnly・SameSite=Lax）
  it('登録すると Cookie が付き、その Cookie でログイン必須の道が通る', async () => {
    const res = await signUp().expect(200);
    const setCookie = (res.headers['set-cookie'] as unknown as string[]).join('\n');
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Lax/i);

    await request(app.getHttpServer()).get(PROTECTED).set('Cookie', cookieOf(res)).expect(200, { status: 'ok', db: 'ok' });
  });

  // T-AUTH-04: 登録で users.avatar が既定値で入る・パスワードは平文で保存されない
  it('登録すると avatar が既定値で入り、パスワードはハッシュで保存される', async () => {
    await signUp().expect(200);
    const { users, accounts } = await withPool(url!, async (pool) => ({
      users: (await pool.query('select name, email, avatar, email_verified from users')).rows,
      accounts: (await pool.query('select password from accounts')).rows,
    }));
    expect(users).toHaveLength(1);
    expect(users[0]).toMatchObject({
      name: 'たろう',
      email: 'taro@example.com',
      email_verified: false,
      avatar: { body: 'A', hair: 1, hairColor: 'brown', shirtColor: 'teal', pantsColor: 'navy' },
    });
    expect(accounts[0].password).not.toContain(credentials.password);
    expect(accounts[0].password.length).toBeGreaterThan(40);
  });

  // T-AUTH-05: ログアウトすると、同じ Cookie はもう使えない（サーバー側のセッションが消える）
  it('ログアウト後は、同じ Cookie でも 401', async () => {
    const cookie = cookieOf(await signUp().expect(200));
    await request(app.getHttpServer()).post('/api/auth/sign-out').set('Origin', TEST_ORIGIN).set('Cookie', cookie).expect(200);
    await request(app.getHttpServer()).get(PROTECTED).set('Cookie', cookie).expect(401);
  });

  // T-AUTH-06: ログイン。パスワードが違えば 401、合っていれば Cookie が付く
  it('ログイン: パスワードが違うと 401、合っていれば Cookie が付く', async () => {
    await signUp().expect(200);
    const login = (password: string) =>
      request(app.getHttpServer()).post('/api/auth/sign-in/email').set('Origin', TEST_ORIGIN).send({ email: credentials.email, password });

    await login('wrong-password-123').expect(401);
    const ok = await login(credentials.password).expect(200);
    await request(app.getHttpServer()).get(PROTECTED).set('Cookie', cookieOf(ok)).expect(200);
  });

  // T-AUTH-07: 同じメールアドレスでは登録できない
  it('同じメールアドレスの2回目の登録は失敗し、ユーザーは1人のまま', async () => {
    await signUp().expect(200);
    const second = await signUp();
    expect(second.status).toBeGreaterThanOrEqual(400);
    expect(second.status).toBeLessThan(500);
    const count = await withPool(url!, async (pool) => (await pool.query('select count(*)::int as n from users')).rows[0].n);
    expect(count).toBe(1);
  });

  // T-AUTH-08: 偽の Cookie は通さない
  it('偽の Cookie では 401', async () => {
    await request(app.getHttpServer()).get(PROTECTED).set('Cookie', 'better-auth.session_token=forged.value').expect(401);
  });
});
