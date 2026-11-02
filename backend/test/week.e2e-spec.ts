import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createApp, migrateDb, resetDb, TEST_ORIGIN } from './helpers/app.js';

// 今週の7マス（GET /week。F-07）の結合テスト（本物の PostgreSQL・本物の better-auth）。DATABASE_URL が無ければ「落ちる」（飛ばさない）。
// docs/testing-design.md 3-3。2026-10-25 は日曜、2026-10-26 は月曜。
const url = process.env.DATABASE_URL;

const cookieOf = (res: request.Response): string =>
  (res.headers['set-cookie'] as unknown as string[]).map((c) => c.split(';')[0]).join('; ');

const SUN_LAST = '2026-10-25T14:59:59.000Z'; // 日本時間の日曜 23:59:59（10/19 の週）
const MON_FIRST = '2026-10-25T15:00:00.000Z'; // 日本時間の月曜 0:00:00（10/26 の週）
const WED = '2026-10-28T03:00:00.000Z'; // 日本時間の水曜 12:00
const NEXT_MON = '2026-11-01T15:00:00.000Z'; // 日本時間の月曜 11/2 0:00（次の週）

type Day = { date: string; status: 'rec' | 'rest' | 'none' };

describe('今週の7マス（結合: 本物の PostgreSQL・better-auth）', () => {
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
      .send({ email: `week${++userSeq}@example.com`, password: 'correct-horse-battery', name })
      .expect(200);
    return cookieOf(res);
  };

  const record = async (cookie: string, kind: 'workout' | 'rest' | 'run', recordedAt: string) => {
    const body: Record<string, unknown> = { id: randomUUID(), kind, recordedAt };
    if (kind === 'run') body.run = { distanceM: 5000, durationS: 1800 };
    await request(app.getHttpServer()).post('/api/records').set('Cookie', cookie).send(body).expect(201);
  };
  const week = (cookie: string, date?: string) => request(app.getHttpServer()).get('/api/week').set('Cookie', cookie).query(date === undefined ? {} : { date });
  const statuses = (days: Day[]): string[] => days.map((d) => d.status);

  it('Cookie なしでは 401', async () => {
    await request(app.getHttpServer()).get('/api/week').query({ date: '2026-10-26' }).expect(401);
  });

  it('記録が無い週は、月曜〜日曜の7日がすべて none', async () => {
    const cookie = await signUpAs('たろう');
    const res = await week(cookie, '2026-10-28').expect(200);
    expect(res.body).toEqual({
      weekStart: '2026-10-26',
      days: ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01'].map((date) => ({ date, status: 'none' })),
    });
  });

  // T-DATE-08: 日曜の date は前の月曜〜その日曜、月曜の date は新しい週
  it.each<[string, string, string]>([
    ['T-DATE-08 日曜（10/25）を渡すと、10/19 の週', '2026-10-25', '2026-10-19'],
    ['T-DATE-08 月曜（10/26）を渡すと、10/26 の週', '2026-10-26', '2026-10-26'],
  ])('%s', async (_name, date, weekStart) => {
    const cookie = await signUpAs('たろう');
    const res = await week(cookie, date).expect(200);
    expect(res.body.weekStart).toBe(weekStart);
    expect(res.body.days).toHaveLength(7);
    expect(res.body.days[0].date).toBe(weekStart);
  });

  it('日曜 23:59:59 と月曜 0:00:00 の記録は別の週のマスに入る（T-DATE-01・02）', async () => {
    const cookie = await signUpAs('たろう');
    await record(cookie, 'workout', SUN_LAST);
    await record(cookie, 'workout', MON_FIRST);

    const lastWeek = (await week(cookie, '2026-10-20').expect(200)).body;
    expect(statuses(lastWeek.days)).toEqual(['none', 'none', 'none', 'none', 'none', 'none', 'rec']); // 日曜だけ
    const thisWeek = (await week(cookie, '2026-10-26').expect(200)).body;
    expect(statuses(thisWeek.days)).toEqual(['rec', 'none', 'none', 'none', 'none', 'none', 'none']); // 月曜だけ
  });

  it('筋トレ・ランは rec、休みは rest、何もない日は none', async () => {
    const cookie = await signUpAs('たろう');
    await record(cookie, 'workout', MON_FIRST); // 月
    await record(cookie, 'rest', '2026-10-26T15:00:00.000Z'); // 火（日本時間 10/27 0:00）
    await record(cookie, 'run', WED); // 水
    const res = await week(cookie, '2026-10-28').expect(200);
    expect(statuses(res.body.days)).toEqual(['rec', 'rest', 'rec', 'none', 'none', 'none', 'none']);
  });

  // T-DATE-09 / UC-13: 同じ日に記録と休みがあれば rec が優先
  it('同じ日に休みと記録があれば rec（記録を先に送っても、休みを先に送っても）', async () => {
    const cookie = await signUpAs('たろう');
    await record(cookie, 'rest', WED);
    await record(cookie, 'workout', WED);
    await record(cookie, 'workout', '2026-10-29T03:00:00.000Z'); // 木
    await record(cookie, 'rest', '2026-10-29T04:00:00.000Z');
    const res = await week(cookie, '2026-10-26').expect(200);
    expect(statuses(res.body.days)).toEqual(['none', 'none', 'rec', 'rec', 'none', 'none', 'none']);
  });

  it('前の週・次の週の記録は入らない', async () => {
    const cookie = await signUpAs('たろう');
    await record(cookie, 'workout', SUN_LAST); // 前の週の日曜
    await record(cookie, 'workout', NEXT_MON); // 次の週の月曜
    const res = await week(cookie, '2026-10-28').expect(200);
    expect(statuses(res.body.days)).toEqual(['none', 'none', 'none', 'none', 'none', 'none', 'none']);
  });

  it('他の人の記録は入らない', async () => {
    const cookie = await signUpAs('たろう');
    const other = await signUpAs('はなこ');
    await record(other, 'workout', WED);
    await record(other, 'rest', MON_FIRST);
    const res = await week(cookie, '2026-10-28').expect(200);
    expect(statuses(res.body.days)).toEqual(['none', 'none', 'none', 'none', 'none', 'none', 'none']);
  });

  it.each<[string, string | undefined]>([
    ['date が無い', undefined],
    ['実在しない日付（2月30日）', '2026-02-30'],
    ['形が違う（スラッシュ）', '2026/10/26'],
    ['日時の形', '2026-10-26T00:00:00Z'],
    ['空', ''],
  ])('%s は 400（VALIDATION_ERROR）', async (_name, date) => {
    const cookie = await signUpAs('たろう');
    const res = await week(cookie, date).expect(400);
    expect(res.body).toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});
