import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createApp, migrateDb, resetDb, TEST_ORIGIN } from './helpers/app.js';

// 記録の書き出し（GET /me/export.csv。C-01）の結合テスト（本物の PostgreSQL・本物の better-auth）。
const url = process.env.DATABASE_URL;
const cookieOf = (res: request.Response): string =>
  (res.headers['set-cookie'] as unknown as string[]).map((c) => c.split(';')[0]).join('; ');
const BENCH_PRESS_ID = '00000000-0000-4000-8000-000000000001'; // chest

describe('記録の書き出し（結合: 本物の PostgreSQL・better-auth）', () => {
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
      .send({ email: `export${++userSeq}@example.com`, password: 'correct-horse-battery', name })
      .expect(200);
    return cookieOf(res);
  };
  const post = (cookie: string, path: string, body: object) =>
    request(app.getHttpServer()).post(`/api/${path}`).set('Cookie', cookie).send(body).expect(201);
  const workout = async (cookie: string, recordedAt: string, sets: { w: number; r: number }[]) => {
    const id = randomUUID();
    await post(cookie, 'records', { id, kind: 'workout', recordedAt });
    for (const [i, s] of sets.entries()) {
      await post(cookie, `records/${id}/sets`, { id: randomUUID(), exerciseId: BENCH_PRESS_ID, setNo: i + 1, weightKg: s.w, reps: s.r });
    }
    return id;
  };
  // 応答の本文を文字列で受け取る（BOM を残すため、自分で utf8 に組み立てる）
  const exportCsv = (cookie: string) =>
    request(app.getHttpServer())
      .get('/api/me/export.csv')
      .set('Cookie', cookie)
      .buffer(true)
      .parse((res, cb) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (c: string) => (data += c));
        res.on('end', () => cb(null, data));
      });

  it('Cookie なしでは 401（CSV は返らない）', async () => {
    const res = await request(app.getHttpServer()).get('/api/me/export.csv').expect(401);
    expect(res.text ?? '').not.toContain('日付');
  });

  it('記録が無ければ、見出しの行だけ（BOM 付き・CSV として返る）', async () => {
    const cookie = await signUpAs('たろう');
    const res = await exportCsv(cookie).expect(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('attachment');
    expect(res.body as string).toBe('﻿日付,種類,種目,部位,セット,重さ(kg),回数,距離(m),時間(秒),きつさ(1-10),メモ\r\n');
  });

  it('自分の筋トレのセット・ラン・休みが、日付順に1行ずつ出る。メモ・きつさは持ち主の記録の行に付く', async () => {
    const cookie = await signUpAs('たろう');
    const wId = await workout(cookie, '2026-11-09T03:00:00.000Z', [
      { w: 40, r: 10 },
      { w: 42.5, r: 8 },
    ]);
    await request(app.getHttpServer()).patch(`/api/records/${wId}/memo`).set('Cookie', cookie).send({ note: 'いい調子', rpe: 7 }).expect(200);
    await post(cookie, 'records', { id: randomUUID(), kind: 'run', recordedAt: '2026-11-10T03:00:00.000Z', run: { distanceM: 5000, durationS: 1800 } });
    await post(cookie, 'records', { id: randomUUID(), kind: 'rest', recordedAt: '2026-11-11T03:00:00.000Z' });

    const res = await exportCsv(cookie).expect(200);
    const lines = (res.body as string).replace('﻿', '').trimEnd().split('\r\n');
    expect(lines).toHaveLength(1 + 2 + 1 + 1);
    expect(lines[1]).toMatch(/^2026-11-09,筋トレ,.+,胸,1,40,10,,,7,いい調子$/);
    expect(lines[2]).toMatch(/^2026-11-09,筋トレ,.+,胸,2,42\.5,8,,,7,いい調子$/);
    expect(lines[3]).toBe('2026-11-10,ラン,,,,,,5000,1800,,');
    expect(lines[4]).toBe('2026-11-11,休み,,,,,,,,,');
  });

  it('他人の記録は出ない（自分の分だけ）', async () => {
    const taro = await signUpAs('たろう');
    const hana = await signUpAs('はな');
    await workout(taro, '2026-11-09T03:00:00.000Z', [{ w: 40, r: 10 }]);
    await workout(hana, '2026-11-09T03:00:00.000Z', [{ w: 99, r: 3 }]);
    await post(hana, 'records', { id: randomUUID(), kind: 'run', recordedAt: '2026-11-10T03:00:00.000Z', run: { distanceM: 12345, durationS: 4000 } });

    const taroCsv = (await exportCsv(taro).expect(200)).body as string;
    expect(taroCsv).toContain(',40,10,');
    expect(taroCsv).not.toContain(',99,3,');
    expect(taroCsv).not.toContain('12345');

    const hanaCsv = (await exportCsv(hana).expect(200)).body as string;
    expect(hanaCsv).toContain(',99,3,');
    expect(hanaCsv).not.toContain(',40,10,');
  });

  it("数式になる種目名は、先頭に ' が付いて無害化される", async () => {
    const cookie = await signUpAs('たろう');
    const ex = await post(cookie, 'exercises', { name: '=HYPERLINK("http://x")', bodyPart: 'arms' });
    const id = randomUUID();
    await post(cookie, 'records', { id, kind: 'workout', recordedAt: '2026-11-09T03:00:00.000Z' });
    await post(cookie, `records/${id}/sets`, { id: randomUUID(), exerciseId: (ex.body as { id: string }).id, setNo: 1, weightKg: 10, reps: 5 });
    const csv = (await exportCsv(cookie).expect(200)).body as string;
    expect(csv).toContain(`"'=HYPERLINK(""http://x"")"`);
    expect(csv).not.toMatch(/,=HYPERLINK/);
  });
});
