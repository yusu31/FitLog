import { Test } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { HealthController } from './health.controller.js';
import { DB } from '../db/db.module.js';

describe('HealthController', () => {
  const makeController = async (execute: () => Promise<unknown>) => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: DB, useValue: { execute } }],
    }).compile();
    return moduleRef.get(HealthController);
  };

  // T-HEALTH-01: DB を見ない浅い確認。常に ok
  it('GET /health は DB に触れず ok を返す', async () => {
    const execute = vi.fn();
    const controller = await makeController(execute);
    expect(controller.check()).toEqual({ status: 'ok' });
    expect(execute).not.toHaveBeenCalled();
  });

  // T-HEALTH-02: DB が答えるとき
  it('GET /health/db は DB が答えたら ok を返す', async () => {
    const controller = await makeController(async () => ({ rows: [{ ok: 1 }] }));
    await expect(controller.checkDb()).resolves.toEqual({ status: 'ok', db: 'ok' });
  });

  // T-HEALTH-03: DB に届かないとき。内部の事情（接続文字列・エラー文）を応答に出さない
  it('GET /health/db は DB に届かないとき 503 を返し、内部の事情を出さない', async () => {
    const controller = await makeController(async () => {
      throw new Error('connect ECONNREFUSED postgres://user:secret@host/db');
    });
    await expect(controller.checkDb()).rejects.toMatchObject({
      status: HttpStatus.SERVICE_UNAVAILABLE,
      response: { code: 'DB_UNAVAILABLE', message: expect.not.stringContaining('secret') },
    });
  });
});
