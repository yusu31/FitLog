import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createApp, migrateDb, resetDb, TEST_ORIGIN, withPool } from './helpers/app.js';

// ランの記録（POST /records の kind=run。F-04）の結合テスト（本物の PostgreSQL・本物の better-auth）。DATABASE_URL が無ければ「落ちる」（飛ばさない）。
const url = process.env.DATABASE_URL;

const cookieOf = (res: request.Response): string =>
  (res.headers['set-cookie'] as unknown as string[]).map((c) => c.split(';')[0]).join('; ');

const AT = '2026-10-26T03:00:00.000Z';

type RunRow = { record_id: string; distance_m: number; duration_s: number };

describe('ランの記録（結合: 本物の PostgreSQL・better-auth）', () => {
  let app: INestApplication;

  beforeAll(async () => {
    if (!url) throw new Error('DATABASE_URL が設定されていません');
    await migrateDb(process.env.MIGRATION_DATABASE_URL ?? url);
  });

  beforeEach(async () => {
    await resetDb(url!);
    app = await createApp(url);
  });

  afterEach(async () => {
    await app?.close();
  });

  let userSeq = 0;
  const signUpAs = async (name: string): Promise<string> => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/sign-up/email')
      .set('Origin', TEST_ORIGIN)
      .send({ email: `run${++userSeq}@example.com`, password: 'correct-horse-battery', name })
      .expect(200);
    return cookieOf(res);
  };

  const post = (cookie: string, body: unknown) => request(app.getHttpServer()).post('/api/records').set('Cookie', cookie).send(body as object);
  const run = (distanceM = 5000, durationS = 1800, id = randomUUID()) => ({ id, kind: 'run', recordedAt: AT, run: { distanceM, durationS } });

  const runRows = (): Promise<RunRow[]> =>
    withPool(url!, async (pool) => (await pool.query('SELECT record_id, distance_m, duration_s FROM run_details ORDER BY record_id')).rows);
  const recordCount = (): Promise<number> => withPool(url!, async (pool) => Number((await pool.query('SELECT count(*) FROM records')).rows[0].count));

  it('代表的なラン（5km・30分）は 201。記録と詳細が1行ずつ入り、応答に run がある', async () => {
    const cookie = await signUpAs('たろう');
    const body = run();
    const res = await post(cookie, body).expect(201);

    expect(res.body).toEqual({ id: body.id, kind: 'run', recordedAt: AT, localDate: '2026-10-26', run: { distanceM: 5000, durationS: 1800 } });
    expect(await runRows()).toEqual([{ record_id: body.id, distance_m: 5000, duration_s: 1800 }]);
  });

  it('筋トレ・休みの応答には run が付かない', async () => {
    const cookie = await signUpAs('たろう');
    const res = await post(cookie, { id: randomUUID(), kind: 'workout', recordedAt: AT }).expect(201);
    expect(res.body).not.toHaveProperty('run');
  });

  // T-RUN-01〜08: 境界値。400 のとき記録も詳細も残らない（片方だけ残らない）
  it.each<[string, number, number, number]>([
    ['T-RUN-01 距離 99', 99, 1800, 400],
    ['T-RUN-02 距離 100', 100, 1800, 201],
    ['T-RUN-03 距離 200000', 200000, 1800, 201],
    ['T-RUN-04 距離 200001', 200001, 1800, 400],
    ['T-RUN-05 時間 59', 5000, 59, 400],
    ['T-RUN-06 時間 60', 5000, 60, 201],
    ['T-RUN-07 時間 86400', 5000, 86400, 201],
    ['T-RUN-08 時間 86401', 5000, 86401, 400],
  ])('%s は %i', async (_name, distanceM, durationS, status) => {
    const cookie = await signUpAs('たろう');
    const res = await post(cookie, run(distanceM, durationS)).expect(status);
    if (status === 400) {
      expect(res.body).toMatchObject({ code: 'VALIDATION_ERROR' });
      expect(await recordCount()).toBe(0);
      expect(await runRows()).toHaveLength(0);
    } else {
      expect(await runRows()).toHaveLength(1);
    }
  });

  it('kind=run で run が無い・run があるのに workout/rest は 400', async () => {
    const cookie = await signUpAs('たろう');
    await post(cookie, { id: randomUUID(), kind: 'run', recordedAt: AT }).expect(400);
    await post(cookie, { id: randomUUID(), kind: 'workout', recordedAt: AT, run: { distanceM: 5000, durationS: 1800 } }).expect(400);
    await post(cookie, { id: randomUUID(), kind: 'rest', recordedAt: AT, run: { distanceM: 5000, durationS: 1800 } }).expect(400);
    expect(await recordCount()).toBe(0);
  });

  describe('再送（冪等）', () => {
    // T-OFF-01 のラン版: 同じ id の2回目は 200。1行のまま、応答は1回目と同じ内容（run を含む）
    it('同じ id の2回目は 200 で、1回目と同じ内容（run を含む）。詳細は1行のまま', async () => {
      const cookie = await signUpAs('たろう');
      const body = run();
      const first = await post(cookie, body).expect(201);
      const second = await post(cookie, body).expect(200);
      expect(second.body).toEqual(first.body);
      expect(await runRows()).toHaveLength(1);
    });

    // T-OFF-03 のラン版: 中身を変えて再送しても、1回目の距離と時間が残る
    it('同じ id で距離・時間を変えて送っても、1回目の内容が残る', async () => {
      const cookie = await signUpAs('たろう');
      const body = run(5000, 1800);
      await post(cookie, body).expect(201);
      const second = await post(cookie, { ...body, run: { distanceM: 10000, durationS: 3600 } }).expect(200);
      expect(second.body.run).toEqual({ distanceM: 5000, durationS: 1800 });
      expect(await runRows()).toEqual([{ record_id: body.id, distance_m: 5000, duration_s: 1800 }]);
    });

    // T-OFF-04 のラン版: 他の人のランと同じ id は 404。距離・時間を漏らさず、上書きもしない
    it('他の人のランと同じ id は 404。他の人の行は変わらない', async () => {
      const cookie = await signUpAs('たろう');
      const other = await signUpAs('はなこ');
      const body = run(5000, 1800);
      await post(cookie, body).expect(201);
      const res = await post(other, run(1000, 600, body.id)).expect(404);
      expect(res.body).toMatchObject({ code: 'RECORD_NOT_FOUND' });
      expect(JSON.stringify(res.body)).not.toContain('5000');
      expect(await runRows()).toEqual([{ record_id: body.id, distance_m: 5000, duration_s: 1800 }]);
    });

    // T-OFF-06 のラン版: 同時に同じ id を2つ送っても、1行・どちらも成功
    it('同時に同じ id を2つ送っても、詳細は1行で、どちらも成功', async () => {
      const cookie = await signUpAs('たろう');
      const body = run();
      const [a, b] = await Promise.all([post(cookie, body), post(cookie, body)]);
      expect([a.status, b.status].sort((x, y) => x - y)).toEqual([200, 201]);
      expect(await runRows()).toHaveLength(1);
    });
  });

  it('DB の CHECK 制約: アプリを通らず範囲外を直接入れても拒否される（距離 99）', async () => {
    const cookie = await signUpAs('たろう');
    const body = run();
    await post(cookie, body).expect(201);
    await withPool(url!, async (pool) => {
      await expect(pool.query('UPDATE run_details SET distance_m = 99 WHERE record_id = $1', [body.id])).rejects.toMatchObject({ code: '23514' });
      await expect(pool.query('UPDATE run_details SET duration_s = 86401 WHERE record_id = $1', [body.id])).rejects.toMatchObject({ code: '23514' });
    });
  });

  it('記録を消すと詳細も消える（ON DELETE CASCADE）', async () => {
    const cookie = await signUpAs('たろう');
    const body = run();
    await post(cookie, body).expect(201);
    await withPool(url!, async (pool) => pool.query('DELETE FROM records WHERE id = $1', [body.id]));
    expect(await runRows()).toHaveLength(0);
  });
});
