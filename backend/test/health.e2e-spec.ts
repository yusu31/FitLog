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

// ---- 想定外のエラー（本物の drizzle のエラーを通す。陽性対照つき）----
import { Controller, Get, Inject, Logger } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DB } from '../src/db/db.module.js';
import type { Db } from '../src/db/db.module.js';

@Controller('boom')
class BoomController {
  constructor(@Inject(DB) private readonly db: Db) {}

  // SQL の引数に「秘密になりうる値」を入れて、DB に届かず失敗させる
  @Get()
  async boom() {
    await this.db.execute(sql`select ${'tok_SECRET_VALUE'}::text`);
  }
}

describe('想定外のエラー（結合: 本物の drizzle のエラー）', () => {
  let app: INestApplication;
  afterEach(async () => {
    await app?.close();
    vi.restoreAllMocks();
  });

  // T-ERR-07: ログにも応答にも SQL の引数を出さず、設計の形で返す
  it('DB に届かない想定外のエラーは 500 の決まった形で、SQL の引数をログにも応答にも出さない', async () => {
    const errorLog = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const staticLog = vi.spyOn(Logger, 'error').mockImplementation(() => undefined);
    process.env.DATABASE_URL = 'postgres://user:pw@127.0.0.1:1/none';
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [BoomController],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    const res = await request(app.getHttpServer()).get('/api/boom').expect(500);

    expect(res.body).toEqual({ code: 'INTERNAL_ERROR', message: 'サーバーでエラーが起きました', details: null });
    const logged = JSON.stringify([errorLog.mock.calls, staticLog.mock.calls]);
    expect(logged).not.toContain('tok_SECRET_VALUE');
    expect(logged).toContain('ECONNREFUSED');
  });
});
