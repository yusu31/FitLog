import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createApp, migrateDb, resetDb, TEST_ORIGIN } from './helpers/app.js';

// 筋肉ヒートマップ（GET /me/heatmap。F-12）の結合テスト（本物の PostgreSQL・本物の better-auth）。DATABASE_URL が無ければ「落ちる」（飛ばさない）。
// docs/testing-design.md 3-10 T-HEAT-05・06。2026-10-25 は日曜、2026-10-26 は月曜。
const url = process.env.DATABASE_URL;

const cookieOf = (res: request.Response): string =>
  (res.headers['set-cookie'] as unknown as string[]).map((c) => c.split(';')[0]).join('; ');

const BENCH_PRESS_ID = '00000000-0000-4000-8000-000000000001'; // chest
const SQUAT_ID = '00000000-0000-4000-8000-000000000024'; // legs

const SUN_LAST = '2026-10-25T14:59:59.000Z'; // 日本時間の日曜 23:59:59（10/19 の週）
const MON_FIRST = '2026-10-25T15:00:00.000Z'; // 日本時間の月曜 0:00:00（10/26 の週）
const WED = '2026-10-28T03:00:00.000Z'; // 日本時間の水曜 12:00

type Part = { bodyPart: string; sets: number };

describe('筋肉ヒートマップ（結合: 本物の PostgreSQL・better-auth）', () => {
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
      .send({ email: `heat${++userSeq}@example.com`, password: 'correct-horse-battery', name })
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
  const heatmap = (cookie: string, weekStart?: string) =>
    request(app.getHttpServer()).get('/api/me/heatmap').set('Cookie', cookie).query(weekStart === undefined ? {} : { weekStart });
  const setsOf = (parts: Part[]): Record<string, number> => Object.fromEntries(parts.map((p) => [p.bodyPart, p.sets]));

  it('Cookie なしでは 401', async () => {
    await request(app.getHttpServer()).get('/api/me/heatmap').query({ weekStart: '2026-10-26' }).expect(401);
  });

  it('記録が無い週は、7つの部位がすべて 0（部位の一覧の順）', async () => {
    const cookie = await signUpAs('たろう');
    const res = await heatmap(cookie, '2026-10-26').expect(200);
    expect(res.body).toEqual({
      weekStart: '2026-10-26',
      parts: ['chest', 'back', 'shoulders', 'arms', 'abs', 'glutes', 'legs'].map((bodyPart) => ({ bodyPart, sets: 0 })),
    });
  });

  it('部位ごとにセット数を数える（同じ週の別の記録も合わせる）。月曜でない日を渡しても、その週に直す', async () => {
    const cookie = await signUpAs('たろう');
    const mon = await record(cookie, 'workout', MON_FIRST);
    await addSets(cookie, mon, BENCH_PRESS_ID, 3);
    const wed = await record(cookie, 'workout', WED);
    await addSets(cookie, wed, BENCH_PRESS_ID, 2);
    await addSets(cookie, wed, SQUAT_ID, 4);

    const res = await heatmap(cookie, '2026-10-29').expect(200);
    expect(res.body.weekStart).toBe('2026-10-26');
    expect(setsOf(res.body.parts)).toEqual({ chest: 5, back: 0, shoulders: 0, arms: 0, abs: 0, glutes: 0, legs: 4 });
  });

  it('T-HEAT-05 日曜 23:59:59 のセットは前の週、月曜 0:00:00 のセットは今週に数える', async () => {
    const cookie = await signUpAs('たろう');
    const sun = await record(cookie, 'workout', SUN_LAST);
    await addSets(cookie, sun, BENCH_PRESS_ID, 2);
    const mon = await record(cookie, 'workout', MON_FIRST);
    await addSets(cookie, mon, SQUAT_ID, 1);

    expect(setsOf((await heatmap(cookie, '2026-10-19').expect(200)).body.parts)).toMatchObject({ chest: 2, legs: 0 });
    expect(setsOf((await heatmap(cookie, '2026-10-26').expect(200)).body.parts)).toMatchObject({ chest: 0, legs: 1 });
  });

  it('T-HEAT-06 休み・ランの記録（セットが無い）では、どの部位も増えない', async () => {
    const cookie = await signUpAs('たろう');
    await record(cookie, 'rest', MON_FIRST);
    await record(cookie, 'run', WED);
    await record(cookie, 'workout', WED); // セットを足していない筋トレ
    const parts: Part[] = (await heatmap(cookie, '2026-10-26').expect(200)).body.parts;
    expect(parts.every((p) => p.sets === 0)).toBe(true);
  });

  it('他の人のセットは数えない', async () => {
    const cookie = await signUpAs('たろう');
    const other = await signUpAs('はなこ');
    const rec = await record(other, 'workout', WED);
    await addSets(other, rec, BENCH_PRESS_ID, 3);
    const parts: Part[] = (await heatmap(cookie, '2026-10-26').expect(200)).body.parts;
    expect(parts.every((p) => p.sets === 0)).toBe(true);
  });

  it.each<[string, string | undefined]>([
    ['weekStart が無い', undefined],
    ['実在しない日付（2月30日）', '2026-02-30'],
    ['形が違う（スラッシュ）', '2026/10/26'],
  ])('%s は 400（VALIDATION_ERROR）', async (_name, weekStart) => {
    const cookie = await signUpAs('たろう');
    const res = await heatmap(cookie, weekStart).expect(400);
    expect(res.body).toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});
