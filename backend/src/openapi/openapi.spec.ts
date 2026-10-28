import { Test } from '@nestjs/testing';
import { buildOpenApiDocument } from './build-document.js';
import { HealthController } from '../health/health.controller.js';
import { DB } from '../db/db.module.js';

// 画面の型は、ここで出す OpenAPI から orval が生成する（docs/tech-stack.md）。
// 形が崩れると画面の型が壊れるので、「どんな名前・形で出すか」をテストで固定する。
describe('OpenAPI の出力', () => {
  const build = async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: DB, useValue: { execute: async () => ({}) } }],
    }).compile();
    const app = moduleRef.createNestApplication();
    const doc = buildOpenApiDocument(app);
    await app.close();
    return doc;
  };

  // T-API-01: パスの先頭は /api（design.md 3章）
  it('パスは /api から始まる', async () => {
    const doc = await build();
    expect(Object.keys(doc.paths).sort()).toEqual(['/api/health', '/api/health/db']);
  });

  // T-API-02: orval が付ける関数名のもとになる operationId。Controller 名を含む既定の長い名前にしない
  it('operationId は短い動詞の名前（getHealth・getHealthDb）', async () => {
    const doc = await build();
    expect(doc.paths['/api/health']?.get?.operationId).toBe('getHealth');
    expect(doc.paths['/api/health/db']?.get?.operationId).toBe('getHealthDb');
  });

  // T-API-03: 成功と失敗の形が、画面の型になる
  it('成功の形と、失敗（503）の共通の形 { code, message, details } を持つ', async () => {
    const doc = await build();
    const schemas = doc.components?.schemas ?? {};
    expect(Object.keys(schemas).sort()).toEqual(['ErrorResponse', 'HealthDbResponse', 'HealthResponse']);
    expect(schemas.ErrorResponse).toMatchObject({ required: ['code', 'message', 'details'] });
    const failure = doc.paths['/api/health/db']?.get?.responses?.['503'];
    expect(JSON.stringify(failure)).toContain('#/components/schemas/ErrorResponse');
  });

  // T-API-04: スキーマ名に Record を使わない（TypeScript の Record<K, V> とぶつかる。docs/tech-stack.md）
  it('スキーマ名に Record を含まない', async () => {
    const doc = await build();
    expect(Object.keys(doc.components?.schemas ?? {}).filter((n) => n.includes('Record'))).toEqual([]);
  });
});
