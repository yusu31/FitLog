import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2, Context } from 'aws-lambda';
import { migrateDb, setAuthEnv, TEST_ORIGIN, withPool } from './helpers/app.js';

// Lambda の入口（src/lambda.ts）の結合テスト。本物の PostgreSQL・本物の better-auth に、
// CloudFront → Function URL が渡す形（payload 2.0）のイベントを直接渡す。AWS には触れない（課金なし）。
// 確かめること: 要求が NestJS まで届く／Set-Cookie が cookies 配列で返る／Cookie が cookies 配列で渡せる／起動の失敗が居座らない。
const url = process.env.DATABASE_URL;
const context = { callbackWaitsForEmptyEventLoop: false } as Context;
const credentials = { email: 'taro@example.com', password: 'correct-horse-battery', name: 'たろう' };

type Handler = (event: APIGatewayProxyEventV2, context: Context) => Promise<APIGatewayProxyStructuredResultV2>;

// Function URL が渡すイベントの形（payload 2.0）。Cookie は headers ではなく cookies 配列に入る
function eventOf(
  method: string,
  path: string,
  options: { headers?: Record<string, string>; cookies?: string[]; body?: unknown } = {},
): APIGatewayProxyEventV2 {
  return {
    version: '2.0',
    routeKey: '$default',
    rawPath: path,
    rawQueryString: '',
    headers: { host: 'abc.lambda-url.ap-northeast-1.on.aws', ...options.headers },
    cookies: options.cookies,
    requestContext: {
      accountId: '123456789012',
      apiId: 'abc',
      domainName: 'abc.lambda-url.ap-northeast-1.on.aws',
      domainPrefix: 'abc',
      http: { method, path, protocol: 'HTTP/1.1', sourceIp: '203.0.113.1', userAgent: 'vitest' },
      requestId: 'req-1',
      routeKey: '$default',
      stage: '$default',
      time: '01/Jan/2026:00:00:00 +0000',
      timeEpoch: 1767225600000,
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    isBase64Encoded: false,
  };
}

// 起動の状態（実行環境の使い回し）はモジュールの中にあるので、テストごとに読み込み直して新しい実行環境にする
async function freshHandler(): Promise<Handler> {
  vi.resetModules();
  const mod = (await import('../src/lambda.js')) as { handler: Handler };
  return mod.handler;
}

const signUp = (handler: Handler, body = credentials) =>
  handler(
    eventOf('POST', '/api/auth/sign-up/email', {
      headers: { 'content-type': 'application/json', origin: TEST_ORIGIN },
      body,
    }),
    context,
  );

describe('Lambda の入口（結合: 本物の PostgreSQL・Function URL 形式のイベント）', () => {
  beforeAll(async () => {
    if (!url) throw new Error('DATABASE_URL が設定されていません');
    await migrateDb(process.env.MIGRATION_DATABASE_URL ?? url);
  });

  beforeEach(async () => {
    process.env.DATABASE_URL = url;
    setAuthEnv();
    process.env.LOG_LEVEL ??= 'WARN';
    await withPool(url!, (pool) => pool.query('TRUNCATE users CASCADE'));
  });

  // T-LAMBDA-01: 要求が NestJS まで届き、本文が返る（ログイン不要の /health）
  it('GET /api/health は 200 と本文が返る', async () => {
    const handler = await freshHandler();
    const res = await handler(eventOf('GET', '/api/health'), context);
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body ?? '')).toEqual({ status: 'ok' });
  });

  // T-LAMBDA-02: Cookie なしでログイン必須の道は 401（ガードが Lambda 経由でも効く）
  it('Cookie なしでログイン必須の道は 401', async () => {
    const handler = await freshHandler();
    const res = await handler(eventOf('GET', '/api/health/db'), context);
    expect(res.statusCode).toBe(401);
  });

  // T-LAMBDA-03: POST の本文が届き、Set-Cookie が cookies 配列で返る。その Cookie を cookies 配列に入れて送ると通る
  it('登録すると cookies 配列に Cookie が返り、それを渡すとログイン必須の道が通る', async () => {
    const handler = await freshHandler();
    const signed = await signUp(handler);
    expect(signed.statusCode).toBe(200);
    expect(signed.cookies?.join('\n')).toMatch(/better-auth\.session_token=.+HttpOnly/i);

    const cookie = signed.cookies![0]!.split(';')[0]!;
    const res = await handler(eventOf('GET', '/api/health/db', { cookies: [cookie] }), context);
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body ?? '')).toEqual({ status: 'ok', db: 'ok' });
  });

  // T-LAMBDA-04: 外のサイトからの書き込みは、Lambda 経由でも 403（Origin 検査）
  it('知らない Origin からの登録は 403', async () => {
    const handler = await freshHandler();
    const res = await handler(
      eventOf('POST', '/api/auth/sign-up/email', {
        headers: { 'content-type': 'application/json', origin: 'https://evil.example' },
        body: credentials,
      }),
      context,
    );
    expect(res.statusCode).toBe(403);
  });

  // T-LAMBDA-05: PATCH・DELETE も NestJS まで届く。存在しない道は NestJS が 404 を返す（入口で止まっていれば 405 や 5xx になる）。
  // 記録 API はまだ無いので、今は「道が無い」で届いたことを確かめる（02-2 で本物の PATCH・DELETE に置き換える）
  it.each(['PATCH', 'DELETE'])('%s は入口で止まらず NestJS まで届く（存在しない道は 404）', async (method) => {
    const handler = await freshHandler();
    const res = await handler(eventOf(method, '/api/no-such-route'), context);
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body ?? '')).toHaveProperty('code', 'NOT_FOUND'); // design.md 5章のエラー形式（NestJS まで届いた証拠）
  });

  // T-LAMBDA-06: 起動に失敗しても、実行環境に居座らない。設定を直せば次の呼び出しで起動できる
  it('起動に失敗しても、次の呼び出しでやり直せる', async () => {
    const handler = await freshHandler();
    const secret = process.env.BETTER_AUTH_SECRET;
    delete process.env.BETTER_AUTH_SECRET;
    await expect(handler(eventOf('GET', '/api/health'), context)).rejects.toThrow('BETTER_AUTH_SECRET');
    process.env.BETTER_AUTH_SECRET = secret;
    const res = await handler(eventOf('GET', '/api/health'), context);
    expect(res.statusCode).toBe(200);
  });

  // T-LAMBDA-07: 実行環境の使い回し。2回目の呼び出しでは起動をやり直さない（コールドスタートを払うのは最初の1回だけ）
  it('2回目の呼び出しは、起動済みの NestJS を使い回して速い', async () => {
    const handler = await freshHandler();
    const t0 = performance.now();
    await handler(eventOf('GET', '/api/health'), context);
    const first = performance.now() - t0;
    const t1 = performance.now();
    await handler(eventOf('GET', '/api/health'), context);
    const second = performance.now() - t1;
    expect(second).toBeLessThan(first / 2);
  });
});
