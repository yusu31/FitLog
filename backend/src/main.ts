import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { setupApp } from './app.setup.js';

async function bootstrap() {
  // bodyParser: false は連携部品の必須設定（/api/auth/* の本文を better-auth が自分で読むため。それ以外の道には連携部品が戻す）
  const app = await NestFactory.create(AppModule, { bodyParser: false, bufferLogs: true });
  setupApp(app);
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
