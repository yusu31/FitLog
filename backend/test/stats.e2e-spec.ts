import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createApp, migrateDb, resetDb, TEST_ORIGIN } from './helpers/app.js';

// 記録をくわしく（GET /me/stats。F-22・F-26・F-27・F-29）の結合テスト（本物の PostgreSQL・本物の better-auth）。DATABASE_URL が無ければ「落ちる」（飛ばさない）。
// docs/testing-design.md 3-14。今日は 2026-11-12（木曜）、2026-11-09 は月曜。
const url = process.env.DATABASE_URL;

const cookieOf = (res: request.Response): string =>
  (res.headers['set-cookie'] as unknown as string[]).map((c) => c.split(';')[0]).join('; ');

const BENCH_PRESS_ID = '00000000-0000-4000-8000-000000000001'; // chest


describe('記録をくわしく（結合: 本物の PostgreSQL・better-auth）', () => {
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
      .send({ email: `stats${++userSeq}@example.com`, password: 'correct-horse-battery', name })
      .expect(200);
    return cookieOf(res);
  };

  const record = async (cookie: string, kind: 'workout' | 'rest' | 'run', recordedAt: string): Promise<string> => {
    const body: Record<string, unknown> = { id: randomUUID(), kind, recordedAt };
    if (kind === 'run') body.run = { distanceM: 5000, durationS: 1800 };
    await request(app.getHttpServer()).post('/api/records').set('Cookie', cookie).send(body).expect(201);
    return body.id as string;
  };
  const addSets = async (cookie: string, recordId: string, exerciseId: string, count: number) => {
    for (let setNo = 1; setNo <= count; setNo++) {
      await request(app.getHttpServer())
        .post(`/api/records/${recordId}/sets`)
        .set('Cookie', cookie)
        .send({ id: randomUUID(), exerciseId, setNo, weightKg: 40, reps: 10 })
        .expect(201);
    }
  };

  const stats = (cookie: string, date?: string) =>
    request(app.getHttpServer()).get('/api/me/stats').set('Cookie', cookie).query(date === undefined ? {} : { date });

  const JST_NOON = (d: string) => `${d}T03:00:00.000Z`; // 日本時間の正午

  it('Cookie なしでは 401', async () => {
    await request(app.getHttpServer()).get('/api/me/stats').query({ date: '2026-11-12' }).expect(401);
  });

  it('記録が無ければ、マスはすべて none・数字は 0・スタンプはすべてまだ', async () => {
    const cookie = await signUpAs('たろう');
    const res = await stats(cookie, '2026-11-12').expect(200);
    expect(res.body.today).toBe('2026-11-12');
    expect(res.body.calendar).toHaveLength(365);
    expect(res.body.calendar.every((c: { status: string }) => c.status === 'none')).toBe(true);
    expect(res.body.month).toEqual({ month: '2026-11', activeDays: 0, restDays: 0, totalWeightKg: 0, runDistanceM: 0 });
    expect(res.body.weekly).toHaveLength(12);
    expect(res.body.stamps.every((s: { earned: boolean }) => !s.earned)).toBe(true);
  });

  it('筋トレ・ラン・休みを日ごとにまとめ、今月の数字・週ごとの合計・スタンプを返す', async () => {
    const cookie = await signUpAs('たろう');
    const workout = await record(cookie, 'workout', JST_NOON('2026-11-12'));
    await addSets(cookie, workout, BENCH_PRESS_ID, 3); // 40kg×10回×3セット＝1200kg
    await record(cookie, 'run', JST_NOON('2026-11-11')); // 5000m
    await record(cookie, 'rest', JST_NOON('2026-11-10'));

    const res = await stats(cookie, '2026-11-12').expect(200);
    const at = (d: string) => res.body.calendar.find((c: { date: string }) => c.date === d).status;
    expect([at('2026-11-12'), at('2026-11-11'), at('2026-11-10'), at('2026-11-09')]).toEqual(['rec', 'rec', 'rest', 'none']);
    expect(res.body.month).toEqual({ month: '2026-11', activeDays: 2, restDays: 1, totalWeightKg: 1200, runDistanceM: 5000 });
    expect(res.body.weekly[11]).toEqual({ weekStart: '2026-11-09', totalWeightKg: 1200, runDistanceM: 5000 });
    const earned = res.body.stamps.filter((s: { earned: boolean }) => s.earned).map((s: { key: string }) => s.key);
    expect(earned).toEqual(['first-record', 'first-run', 'first-5k', 'weight-1t']);
  });

  it('同じ日に記録と休みがあれば、その日は rec（休みの日として数えない）', async () => {
    const cookie = await signUpAs('たろう');
    await record(cookie, 'workout', JST_NOON('2026-11-10'));
    await record(cookie, 'rest', JST_NOON('2026-11-10'));
    const res = await stats(cookie, '2026-11-12').expect(200);
    expect(res.body.month).toMatchObject({ activeDays: 1, restDays: 0 });
  });

  it('月の境目は日本時間で決める（10-31 23:59:59 は先月・11-01 0:00:00 は今月）', async () => {
    const cookie = await signUpAs('たろう');
    await record(cookie, 'workout', '2026-10-31T14:59:59.000Z');
    await record(cookie, 'workout', '2026-10-31T15:00:00.000Z');
    const res = await stats(cookie, '2026-11-12').expect(200);
    expect(res.body.month.activeDays).toBe(1);
  });

  it('他の人の記録は数えない', async () => {
    const cookie = await signUpAs('たろう');
    const other = await signUpAs('はなこ');
    const rec = await record(other, 'workout', JST_NOON('2026-11-12'));
    await addSets(other, rec, BENCH_PRESS_ID, 3);
    const res = await stats(cookie, '2026-11-12').expect(200);
    expect(res.body.month.activeDays).toBe(0);
    expect(res.body.stamps.every((s: { earned: boolean }) => !s.earned)).toBe(true);
  });

  it.each<[string, string | undefined]>([
    ['date が無い', undefined],
    ['実在しない日付（2月30日）', '2026-02-30'],
    ['形が違う（スラッシュ）', '2026/11/12'],
  ])('%s は 400（VALIDATION_ERROR）', async (_name, date) => {
    const cookie = await signUpAs('たろう');
    const res = await stats(cookie, date).expect(400);
    expect(res.body).toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});
