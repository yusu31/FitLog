import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';

// API の仕様（OpenAPI）を作る。画面の型と TanStack Query の部品は、これから orval が生成する（docs/tech-stack.md）。
// パスの先頭は /api（docs/design.md 3章）。main.ts と同じ接頭辞をここでも付ける。
export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  app.setGlobalPrefix('api');
  const config = new DocumentBuilder()
    .setTitle('FitLog API')
    .setDescription('少人数で使う、筋トレとランの記録アプリの API')
    .setVersion('0.1.0')
    .build();
  return SwaggerModule.createDocument(app, config);
}
