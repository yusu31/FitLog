// .lambda/ に作った一式が、実際に動くかを確かめる（npm run package:lambda のあとに node scripts/smoke-lambda.mjs）。
// 取り除いた依存のせいで起動しない、という事故を、Lambda に上げる前に見つける。DATABASE_URL・BETTER_AUTH_SECRET が要る。
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = resolve(process.argv[2] ?? '.lambda');
process.env.LOG_LEVEL ??= 'WARN';
const startedAt = performance.now();
const { handler } = await import(pathToFileURL(join(dir, 'dist', 'lambda.js')).href);
const importMs = Math.round(performance.now() - startedAt);

const event = (method, path) => ({
  version: '2.0',
  routeKey: '$default',
  rawPath: path,
  rawQueryString: '',
  headers: { host: 'abc.lambda-url.ap-northeast-1.on.aws' },
  requestContext: {
    http: { method, path, protocol: 'HTTP/1.1', sourceIp: '203.0.113.1', userAgent: 'smoke' },
    requestId: 'smoke',
    stage: '$default',
    domainName: 'abc.lambda-url.ap-northeast-1.on.aws',
    accountId: '123456789012',
    apiId: 'abc',
    domainPrefix: 'abc',
    routeKey: '$default',
    time: '',
    timeEpoch: 0,
  },
  isBase64Encoded: false,
});
const context = { callbackWaitsForEmptyEventLoop: false };

const t1 = performance.now();
const health = await handler(event('GET', '/api/health'), context);
const firstCallMs = Math.round(performance.now() - t1);
const guarded = await handler(event('GET', '/api/health/db'), context);

console.log(JSON.stringify({ importMs, firstCallMs, health: health.statusCode, guarded: guarded.statusCode }));
// /health は 200、ログイン必須の道は Cookie なしで 401（ガードが効いている）。違えば失敗
if (health.statusCode !== 200 || guarded.statusCode !== 401) {
  console.error('期待と違います（/api/health は 200、/api/health/db は 401 のはず）');
  process.exit(1);
}
process.exit(0);
