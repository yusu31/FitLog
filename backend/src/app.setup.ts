import { Logger, type INestApplication } from '@nestjs/common';
import { JsonLogger, parseLevel } from './common/json-logger.js';
import { requestLoggingMiddleware } from './common/request-logging.middleware.js';
import { installSafeConsole } from './common/safe-console.js';

// アプリの組み立て（本番の起動・Lambda の入口・結合テストで同じものを使う。ずれると、テストが本番を守れなくなる）。
// NestFactory.create のほうで渡すもの: bodyParser: false（連携部品の必須設定）・bufferLogs: true（ロガーを差し替える前のログを溜める）。
export function setupApp(app: INestApplication): void {
  app.useLogger(new JsonLogger(parseLevel(process.env.LOG_LEVEL)));
  // better-auth の部品が console.error に出す DB のエラー（SQL の引数を含む）を、秘密を出さない形に包む（safe-console.ts）
  installSafeConsole(new Logger('Console'));
  app.use(requestLoggingMiddleware);
  // API のパスはすべて /api から始める（docs/design.md 3章）
  app.setGlobalPrefix('api');
}
