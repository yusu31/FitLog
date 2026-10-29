import { configure } from '@codegenie/serverless-express';
import { NestFactory } from '@nestjs/core';
import type { Handler } from 'aws-lambda';
import { AppModule } from './app.module.js';
import { setupApp } from './app.setup.js';
import { loadSecretsFromSsm } from './config/ssm-secrets.js';

// Lambda の入口（docs/infrastructure.md 3章・tech-stack.md「Lambda に載せる部品」）。
// CloudFront → Function URL（payload 2.0）のイベントを、Express の要求に変えて NestJS に渡す。
// 本番の起動（main.ts）と同じ組み立て（setupApp・bodyParser: false）を使う。ずれると、テストが本番を守れなくなる。
//
// serverless-express は名前付き import で使う（既定の import や .default は、CI は通るのに Lambda で即死する。tech-stack.md）。
type LambdaHandler = ReturnType<typeof configure>;

// Lambda は実行環境を使い回すので、NestJS の起動は最初の1回だけにする（起動の遅さ＝コールドスタートを毎回払わない）。
// 起動に失敗したら捨てて、次の呼び出しでやり直す（失敗が実行環境に居座らないように）。
let cached: Promise<LambdaHandler> | undefined;

async function bootstrap(): Promise<LambdaHandler> {
  // 秘密情報（接続文字列・署名鍵・外向きアドレス）を Parameter Store から読んで、環境変数に入れる（config/ssm-secrets.ts）。
  // FITLOG_SSM_PREFIX が無ければ何もしない（手元・テスト）。NestFactory.create より前に呼ぶ: DB と認証の設定が、起動時に環境変数を読むため
  await loadSecretsFromSsm(process.env);
  // abortOnError: false — 既定では、起動の失敗で NestJS がプロセスごと終了させる（process.exit）。
  // それだと「失敗を捨てて次の呼び出しでやり直す」が働かない。例外として受け取り、下の catch で後始末する
  const app = await NestFactory.create(AppModule, { bodyParser: false, bufferLogs: true, abortOnError: false });
  setupApp(app);
  await app.init();
  // listen はしない（ポートを開かない）。Express のアプリそのものを serverless-express に渡す
  return configure({ app: app.getHttpAdapter().getInstance() as Parameters<typeof configure>[0]['app'] });
}

export const handler: Handler = async (event, context, callback) => {
  cached ??= bootstrap().catch((error: unknown) => {
    cached = undefined;
    throw error;
  });
  const server = await cached;
  return server(event, context, callback);
};
