import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createApp, migrateDb, TEST_ORIGIN, withPool } from './helpers/app.js';

// リクエストのログの結合テスト（本物の PostgreSQL・better-auth）。operations.md 1-1〜1-3 の約束を確かめる。
const url = process.env.DATABASE_URL;
const credentials = { email: 'log-check@example.com', password: 'very-secret-pass-phrase', name: 'ろぐ確認' };

describe('リクエストのログ（結合）', () => {
  let app: INestApplication;
  let output: string[];
  const realLevel = process.env.LOG_LEVEL;

  beforeAll(async () => {
    if (!url) throw new Error('DATABASE_URL が設定されていません');
    await migrateDb(process.env.MIGRATION_DATABASE_URL ?? url);
  });

  beforeEach(async () => {
    await withPool(url!, (pool) => pool.query('TRUNCATE users CASCADE'));
    process.env.LOG_LEVEL = 'INFO';
    output = [];
    // 標準出力・標準エラー出力・console の全部を集める（better-auth の標準のログは console.error に出る）
    const capture = (chunk: string | Uint8Array) => {
      output.push(String(chunk));
      return true;
    };
    vi.spyOn(process.stdout, 'write').mockImplementation(capture);
    vi.spyOn(process.stderr, 'write').mockImplementation(capture);
    // Vitest は console を自分の出力先に差し替えているので、process.*.write の見張りでは console.error に届かない。console も直接見張る
    for (const method of ['log', 'info', 'warn', 'error', 'debug'] as const) {
      vi.spyOn(console, method).mockImplementation((...args: unknown[]) => void output.push(args.map(String).join(' ') + '\n'));
    }
    // 見張りを付けてからアプリを作る。アプリは console.error を包む（safe-console.ts）ので、その包みごと検査するため
    app = await createApp(url);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    if (realLevel === undefined) delete process.env.LOG_LEVEL;
    else process.env.LOG_LEVEL = realLevel;
    await app?.close();
  });

  const lines = () =>
    output
      .join('')
      .split('\n')
      .filter((l) => l.startsWith('{'))
      .map((l) => JSON.parse(l) as Record<string, unknown>);
  const requestLines = () => lines().filter((l) => l.event === 'http.request');

  // T-LOG-06: リクエストごとに1行。必要な項目がそろい、応答の X-Request-Id と同じ値
  it('リクエストごとに1行、項目がそろい、requestId は応答の X-Request-Id と一致する', async () => {
    const res = await request(app.getHttpServer()).get('/api/health').expect(200);
    const [line] = requestLines();
    expect(line).toMatchObject({ level: 'INFO', msg: 'request', method: 'GET', route: '/api/health', status: 200 });
    expect(typeof line.durationMs).toBe('number');
    expect(line.requestId).toBe(res.headers['x-request-id']);
    expect(line.requestId).toMatch(/^[0-9a-f-]{36}$/);
  });

  // T-LOG-07: 正しい形の X-Request-Id はそのまま使い、変な値は捨てて作り直す（ログに好きな文字列を入れさせない）
  it('X-Request-Id は、形が正しければ使い、そうでなければ作り直す', async () => {
    const ok = await request(app.getHttpServer()).get('/api/health').set('X-Request-Id', 'client-req-0001').expect(200);
    expect(ok.headers['x-request-id']).toBe('client-req-0001');

    const bad = await request(app.getHttpServer()).get('/api/health').set('X-Request-Id', 'bad id with spaces').expect(200);
    expect(bad.headers['x-request-id']).not.toBe('bad id with spaces');
    expect(bad.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  // T-LOG-08: パスの型だけを出す。実際のパス（招待リンクの値など）は出さない
  it('パスの型だけを出し、実際のパスの値（招待リンクの値など）は出さない', async () => {
    await request(app.getHttpServer()).get('/api/invitations/SECRET-INVITE-TOKEN-0123').expect(404);
    const text = output.join('');
    expect(text).not.toContain('SECRET-INVITE-TOKEN-0123');
    // 招待の閲覧の道（02-2）ができたので、型は /api/invitations/:token になる。値は型に置き換わって出ない
    expect(requestLines()[0]).toMatchObject({ route: '/api/invitations/:token', status: 404 });
  });

  // T-LOG-10: DB のエラー（better-auth の中で起きる）でも、SQL の引数をログに出さない。
  // accounts 表の名前を一時的に変えて、登録を失敗させる。必ず戻す。
  it('登録の途中で DB のエラーが起きても、SQL とその引数（provider_id の credential など）はログに出ない', async () => {
    await withPool(url!, (pool) => pool.query('alter table accounts rename to accounts_tmp'));
    try {
      const res = await request(app.getHttpServer()).post('/api/auth/sign-up/email').set('Origin', TEST_ORIGIN).send(credentials);
      expect(res.status).toBeGreaterThanOrEqual(500);
    } finally {
      await withPool(url!, (pool) => pool.query('alter table accounts_tmp rename to accounts'));
    }
    const text = output.join('');
    // 陽性対照: エラーはログに出ている（ログが空だから通る、ではない）
    expect(lines().some((l) => l.level === 'ERROR')).toBe(true);
    expect(text).not.toContain('credential'); // 引数 provider_id の値。SQL の文面（$1,$2…）には出てこない
    expect(text).not.toContain('Failed query');
    expect(text).not.toContain(credentials.email);
  });

  // T-LOG-09: 秘密を出さない（operations.md 1-3）。登録・ログイン・ログアウトを通して、全出力を検査する
  it('パスワード・メールアドレス・Cookie の値・クエリ文字列は、ログのどこにも出ない', async () => {
    const signUp = await request(app.getHttpServer())
      .post('/api/auth/sign-up/email')
      .set('Origin', TEST_ORIGIN)
      .send(credentials)
      .expect(200);
    const cookies = signUp.headers['set-cookie'] as unknown as string[];
    const cookie = cookies.map((c) => c.split(';')[0]).join('; ');
    const cookieValue = cookie.split('=').slice(1).join('=');
    await request(app.getHttpServer()).get('/api/health/db?token=QUERY-SECRET-9999').set('Cookie', cookie).expect(200);
    await request(app.getHttpServer()).post('/api/auth/sign-out').set('Origin', TEST_ORIGIN).set('Cookie', cookie).expect(200);

    const text = output.join('');
    for (const secret of [credentials.password, credentials.email, credentials.name, cookieValue, 'QUERY-SECRET-9999']) {
      expect(text, `ログに「${secret.slice(0, 12)}…」が出ている`).not.toContain(secret);
    }
    // 陽性対照: ログは実際に出ていて、ログイン中の本人の userId は出る
    const authed = requestLines().find((l) => l.route === '/api/health/db');
    expect(authed?.status).toBe(200);
    const { rows } = await withPool(url!, (pool) => pool.query('select id from users'));
    expect(authed?.userId).toBe(rows[0].id);
    expect(requestLines().some((l) => l.route === '/api/auth/sign-up/email')).toBe(true);
  });
});
