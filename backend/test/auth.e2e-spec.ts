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
    // 表の作成は直接接続で（本番のマイグレーションと同じ）。アプリ側は DATABASE_URL（PgBouncer 経由）
    await migrateDb(process.env.MIGRATION_DATABASE_URL ?? url);
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

  // T-AUTH-09: 別のサイトから Cookie 付きで送られた書き込み（CSRF）は、better-auth の Origin 検査で拒否される。
  // 連携部品 2.8.0 には Nest 側の Origin 検査の設定は無い。/api/auth/* はこの検査、それ以外は SameSite=Lax の Cookie で守る
  it('知らない Origin からのログアウトは 403 で、セッションは消えない', async () => {
    const cookie = cookieOf(await signUp().expect(200));
    await request(app.getHttpServer())
      .post('/api/auth/sign-out')
      .set('Origin', 'https://evil.example')
      .set('Cookie', cookie)
      .expect(403);
    await request(app.getHttpServer()).get(PROTECTED).set('Cookie', cookie).expect(200);
  });

  // T-AUTH-10: Cookie なしのログインでも、知らない Origin は断る（ログイン CSRF: 攻撃者のアカウントに入れさせられる）
  it('知らない Origin からのログイン・登録は 403', async () => {
    await signUp().expect(200);
    await request(app.getHttpServer())
      .post('/api/auth/sign-in/email')
      .set('Origin', 'https://evil.example')
      .send({ email: credentials.email, password: credentials.password })
      .expect(403);
    await request(app.getHttpServer())
      .post('/api/auth/sign-up/email')
      .set('Origin', 'https://evil.example')
      .send({ ...credentials, email: 'other@example.com' })
      .expect(403);
  });

  // T-AUTH-11: 本番（https のサイト）では、Cookie に Secure が付く（design.md 2章）。付かないと http でも Cookie が流れる
  it('https のサイトでは、Cookie に Secure が付く', async () => {
    await app.close();
    const prev = process.env.BETTER_AUTH_URL;
    process.env.BETTER_AUTH_URL = 'https://fitlog.example';
    try {
      app = await createApp(url);
      const res = await request(app.getHttpServer())
        .post('/api/auth/sign-up/email')
        .set('Origin', 'https://fitlog.example')
        .send(credentials)
        .expect(200);
      expect((res.headers['set-cookie'] as unknown as string[]).join('\n')).toMatch(/;\s*Secure/i);
    } finally {
      if (prev === undefined) delete process.env.BETTER_AUTH_URL;
      else process.env.BETTER_AUTH_URL = prev;
    }
  });

  // T-AUTH-12: パスワードの長さの境界（8文字未満は拒否・8文字は通る）。画面の minlength だけでは、直接 API を叩く人を止められない
  it('パスワードは 8 文字未満を拒否し、8 文字は通す', async () => {
    const short = await signUp({ ...credentials, password: '1234567' });
    expect(short.status).toBe(400);
    await signUp({ ...credentials, password: '12345678' }).expect(200);
  });

  // T-AUTH-13: 表示名の長さ（空・31文字は拒否、30文字は通る）。画面の maxLength=30 と同じ境界を、サーバーでも守る
  it('表示名は 1〜30 文字だけ通す', async () => {
    expect((await signUp({ ...credentials, name: '' })).status).toBe(400);
    expect((await signUp({ ...credentials, name: 'あ'.repeat(31) })).status).toBe(400);
    await signUp({ ...credentials, name: 'あ'.repeat(30) }).expect(200);
  });

  // T-AUTH-08: 偽の Cookie は通さない
  it('偽の Cookie では 401', async () => {
    await request(app.getHttpServer()).get(PROTECTED).set('Cookie', 'better-auth.session_token=forged.value').expect(401);
  });
});
