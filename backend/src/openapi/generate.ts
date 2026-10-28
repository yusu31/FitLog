import { NestFactory } from '@nestjs/core';
import { writeFileSync } from 'node:fs';
import { AppModule } from '../app.module.js';
import { buildOpenApiDocument } from './build-document.js';

// openapi.json を書き出す（npm run openapi）。DB には触れない（Pool は最初の問い合わせまでつながない）ので、
// 接続先はダミーでよい。CI は、これを再生成して差分が出たら「仕様が古い」と落とす。
process.env.DATABASE_URL ??= 'postgres://openapi:openapi@localhost:1/openapi';

const app = await NestFactory.create(AppModule, { logger: false });
const document = buildOpenApiDocument(app);
// 差分を読みやすく、OS で変わらないように、整形して LF で書く
writeFileSync(new URL('../../openapi.json', import.meta.url), JSON.stringify(document, null, 2) + '\n', 'utf-8');
await app.close();
