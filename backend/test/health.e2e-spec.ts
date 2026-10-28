import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';

// 本物の PostgreSQL につなぐ結合テスト。DATABASE_URL が無ければ「落ちる」（飛ばさない。0件成功を防ぐ）。
const start = async (databaseUrl: string | undefined): Promise<INestApplication> => {
  if (!databaseUrl) throw new Error('DATABASE_URL が設定されていません（docker compose up -d db のあと、.env.example を参照）');
  process.env.DATABASE_URL = databaseUrl;
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api');
  await app.init();
  return app;
};

describe('Health (結合: 本物の PostgreSQL)', () => {
  const realUrl = process.env.DATABASE_URL;
  let app: INestApplication;

  afterEach(async () => {
    await app?.close();
    if (realUrl) process.env.DATABASE_URL = realUrl;
  });

  // T-HEALTH-04: 実際に DB に届く
  it('GET /api/health/db は、実際の DB に select 1 が通れば 200', async () => {
    app = await start(realUrl);
    await request(app.getHttpServer()).get('/api/health/db').expect(200, { status: 'ok', db: 'ok' });
  });

  // T-HEALTH-05: DB に届かないとき（閉じたポート）。応答に接続先の情報を出さない
  it('GET /api/health/db は、DB に届かなければ 503 で、接続先を応答に出さない', async () => {
    app = await start('postgres://user:secretpw@127.0.0.1:1/none');
    const res = await request(app.getHttpServer()).get('/api/health/db').expect(503);
    expect(res.body).toMatchObject({ code: 'DB_UNAVAILABLE' });
    expect(JSON.stringify(res.body)).not.toContain('secretpw');
  });

  // T-HEALTH-06: 浅い確認は DB が落ちていても 200（起動の確認）
  it('GET /api/health は、DB に届かなくても 200', async () => {
    app = await start('postgres://user:secretpw@127.0.0.1:1/none');
    await request(app.getHttpServer()).get('/api/health').expect(200, { status: 'ok' });
  });
});
