import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createApp, migrateDb, resetDb, TEST_ORIGIN, withPool } from './helpers/app.js';

// 動画の署名付き URL の発行（POST /records/{id}/video・GET /videos/{id}/url。F-13）の結合テスト（本物の PostgreSQL・better-auth）。
// S3 の署名は手元の計算だけなので、偽の認証情報で足りる。S3 が条件を守って弾くかは、公開（02-3）の後に実物で確かめる
const url = process.env.DATABASE_URL;
const RECORDED_AT = '2026-10-26T03:00:00.000Z';
const body = { contentType: 'video/mp4', sizeBytes: 1_500_000 };

const cookieOf = (res: request.Response): string => (res.headers['set-cookie'] as unknown as string[]).map((c) => c.split(';')[0]).join('; ');

type UploadResponse = { id: string; upload: { url: string; fields: Record<string, string> }; expiresInSeconds: number };
type VideoRow = { id: string; record_id: string; s3_key: string; content_type: string; size_bytes: number; visible_until: Date };

describe('動画の署名付き URL（結合: 本物の PostgreSQL・better-auth）', () => {
  let app: INestApplication;

  beforeAll(async () => {
    if (!url) throw new Error('DATABASE_URL が設定されていません');
    process.env.VIDEO_BUCKET = 'fitlog-test-bucket';
    process.env.AWS_ACCESS_KEY_ID = 'AKIAFAKEFAKEFAKE';
    process.env.AWS_SECRET_ACCESS_KEY = 'fake-secret';
    await migrateDb(process.env.MIGRATION_DATABASE_URL ?? url);
  });

  beforeEach(async () => {
    await resetDb(url!);
    app = await createApp(url);
  });

  afterEach(async () => {
    await app?.close();
  });

  const http = () => request(app.getHttpServer());
  let userSeq = 0;
  const signUpAs = async (name: string): Promise<string> =>
    cookieOf(await http().post('/api/auth/sign-up/email').set('Origin', TEST_ORIGIN).send({ email: `user${++userSeq}@example.com`, password: 'correct-horse-battery', name }).expect(200));

  const createRecord = async (cookie: string, kind: 'workout' | 'run' | 'rest' = 'workout', recordedAt = RECORDED_AT): Promise<string> => {
    const id = randomUUID();
    const extra = kind === 'run' ? { run: { distanceM: 5000, durationS: 1800 } } : {};
    await http().post('/api/records').set('Cookie', cookie).send({ id, kind, recordedAt, ...extra }).expect(201);
    return id;
  };
  const issue = (cookie: string, recordId: string, b: unknown = body) => http().post(`/api/records/${recordId}/video`).set('Cookie', cookie).send(b as object);
  const viewUrl = (cookie: string, videoId: string) => http().get(`/api/videos/${videoId}/url`).set('Cookie', cookie);
  const videoRows = (): Promise<VideoRow[]> => withPool(url!, async (pool) => (await pool.query('SELECT * FROM videos ORDER BY created_at')).rows as VideoRow[]);

  // 作った人＋仲間1人のグループ。Cookie（作った人, 仲間）
  const groupOfTwo = async (): Promise<[string, string]> => {
    const a = await signUpAs('A1');
    await http().post('/api/groups').set('Cookie', a).send({ name: 'グループA' }).expect(201);
    const { token } = (await http().post('/api/groups/current/invitations').set('Cookie', a).expect(201)).body as { token: string };
    const b = await signUpAs('A2');
    await http().post(`/api/invitations/${token}/accept`).set('Cookie', b).expect(200);
    return [a, b];
  };

  describe('POST /records/{id}/video（置くための署名付き POST を発行）', () => {
    it('Cookie なしでは 401', async () => {
      await http().post(`/api/records/${randomUUID()}/video`).send(body).expect(401);
    });

    it('自分の筋トレの記録に発行すると 201。行ができ、署名の条件にサイズと形式が入る', async () => {
      const cookie = await signUpAs('me');
      const recordId = await createRecord(cookie);
      const res = await issue(cookie, recordId).expect(201);
      const out = res.body as UploadResponse;
      expect(out.expiresInSeconds).toBe(300);
      expect(out.upload.url).toContain('fitlog-test-bucket');
      expect(out.upload.fields.key).toBe(`videos/${recordId}`);
      const policy = JSON.parse(Buffer.from(out.upload.fields.Policy!, 'base64').toString('utf8')) as { conditions: unknown[] };
      expect(policy.conditions).toContainEqual(['content-length-range', 1_500_000, 1_500_000]);
      expect(policy.conditions).toContainEqual(['eq', '$Content-Type', 'video/mp4']);

      const rows = await videoRows();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ id: out.id, record_id: recordId, s3_key: `videos/${recordId}`, content_type: 'video/mp4', size_bytes: 1_500_000 });
    });

    it('見える期限は、記録の週の日曜 24:00（日本時間）= 2026-11-01T15:00:00Z', async () => {
      const cookie = await signUpAs('me');
      await issue(cookie, await createRecord(cookie)).expect(201);
      expect((await videoRows())[0]!.visible_until.toISOString()).toBe('2026-11-01T15:00:00.000Z');
    });

    it('やり直し: 同じ記録にもう一度発行すると 200。行は1つのまま新しい申告に更新され、同じキーで署名し直す（1本目が失敗しても撮り直せる）', async () => {
      const cookie = await signUpAs('me');
      const recordId = await createRecord(cookie);
      const first = (await issue(cookie, recordId).expect(201)).body as UploadResponse;
      const second = (await issue(cookie, recordId, { contentType: 'video/webm', sizeBytes: 900_000 }).expect(200)).body as UploadResponse;
      expect(second.id).toBe(first.id);
      expect(second.upload.fields.key).toBe(first.upload.fields.key);
      const rows = await videoRows();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ content_type: 'video/webm', size_bytes: 900_000 });
    });

    it('サイズが上限 +1・形式が違う・空は 400（VALIDATION_ERROR）で、行はできない', async () => {
      const cookie = await signUpAs('me');
      const recordId = await createRecord(cookie);
      for (const bad of [{ ...body, sizeBytes: 10_485_761 }, { ...body, contentType: 'image/png' }, {}]) {
        const res = await issue(cookie, recordId, bad).expect(400);
        expect((res.body as { code: string }).code).toBe('VALIDATION_ERROR');
      }
      expect(await videoRows()).toHaveLength(0);
    });

    it('筋トレでない記録（ラン・休み）には 409 RECORD_KIND_MISMATCH', async () => {
      const cookie = await signUpAs('me');
      for (const kind of ['run', 'rest'] as const) {
        const res = await issue(cookie, await createRecord(cookie, kind)).expect(409);
        expect((res.body as { code: string }).code).toBe('RECORD_KIND_MISMATCH');
      }
    });

    it('他の人の記録・無い記録・UUID でない id は、どれも 404 RECORD_NOT_FOUND（仲間の記録でも付けられない）', async () => {
      const [a, b] = await groupOfTwo();
      const aRecord = await createRecord(a);
      for (const target of [aRecord, randomUUID(), 'not-a-uuid']) {
        const res = await issue(b, target).expect(404);
        expect((res.body as { code: string }).code).toBe('RECORD_NOT_FOUND');
      }
      expect(await videoRows()).toHaveLength(0);
    });
  });

  describe('GET /videos/{id}/url（見るための署名付き URL を発行）', () => {
    const issued = async (cookie: string): Promise<string> => {
      const recordId = await createRecord(cookie);
      return ((await issue(cookie, recordId).expect(201)).body as UploadResponse).id;
    };
    const setVisibleUntil = (videoId: string, iso: string) => withPool(url!, (pool) => pool.query('UPDATE videos SET visible_until = $2 WHERE id = $1', [videoId, iso]));

    it('Cookie なしでは 401', async () => {
      await http().get(`/api/videos/${randomUUID()}/url`).expect(401);
    });

    it('本人は見られる。URL の期限は 300 秒', async () => {
      const [a] = await groupOfTwo();
      const videoId = await issued(a);
      const res = (await viewUrl(a, videoId).expect(200)).body as { url: string; expiresInSeconds: number };
      expect(res.expiresInSeconds).toBe(300);
      expect(new URL(res.url).searchParams.get('X-Amz-Expires')).toBe('300');
    });

    it('同じグループの仲間は、期限の前なら見られる', async () => {
      const [a, b] = await groupOfTwo();
      const videoId = await issued(a);
      await setVisibleUntil(videoId, new Date(Date.now() + 60_000).toISOString());
      await viewUrl(b, videoId).expect(200);
    });

    it('仲間は期限を過ぎると 403 FORBIDDEN。本人は期限が過ぎても見られる', async () => {
      const [a, b] = await groupOfTwo();
      const videoId = await issued(a);
      await setVisibleUntil(videoId, new Date(Date.now() - 1_000).toISOString());
      const res = await viewUrl(b, videoId).expect(403);
      expect((res.body as { code: string }).code).toBe('FORBIDDEN');
      await viewUrl(a, videoId).expect(200);
    });

    it('別のグループの人・グループに入っていない人・無い id・UUID でない id は、どれも 404 VIDEO_NOT_FOUND（存在を教えない）', async () => {
      const [a] = await groupOfTwo();
      const videoId = await issued(a);
      await setVisibleUntil(videoId, new Date(Date.now() + 60_000).toISOString());
      const outsider = await signUpAs('outsider');
      const other = await signUpAs('B1');
      await http().post('/api/groups').set('Cookie', other).send({ name: 'グループB' }).expect(201);
      for (const [who, target] of [[outsider, videoId], [other, videoId], [a, randomUUID()], [a, 'not-a-uuid']] as const) {
        const res = await viewUrl(who, target).expect(404);
        expect((res.body as { code: string }).code).toBe('VIDEO_NOT_FOUND');
      }
    });

    it('記録を消すと動画の行も消える（CASCADE）', async () => {
      const cookie = await signUpAs('me');
      const recordId = await createRecord(cookie);
      await issue(cookie, recordId).expect(201);
      await http().delete(`/api/records/${recordId}`).set('Cookie', cookie).expect(204);
      expect(await videoRows()).toHaveLength(0);
    });
  });

  describe('GET /records/{id} の videoId（記録の詳細から動画を再生するための印）', () => {
    it('動画が無い記録には付かない。発行した後は videoId が付く（本人も仲間も同じ値）', async () => {
      const [a, b] = await groupOfTwo();
      const recordId = await createRecord(a);
      const before = (await http().get(`/api/records/${recordId}`).set('Cookie', a).expect(200)).body as { videoId?: string };
      expect(before.videoId).toBeUndefined();

      const videoId = ((await issue(a, recordId).expect(201)).body as UploadResponse).id;
      const mine = (await http().get(`/api/records/${recordId}`).set('Cookie', a).expect(200)).body as { videoId?: string };
      const friends = (await http().get(`/api/records/${recordId}`).set('Cookie', b).expect(200)).body as { videoId?: string };
      expect(mine.videoId).toBe(videoId);
      expect(friends.videoId).toBe(videoId);
    });

    it('やり直しで同じ記録に再度発行しても、videoId は変わらない', async () => {
      const cookie = await signUpAs('me');
      const recordId = await createRecord(cookie);
      const first = ((await issue(cookie, recordId).expect(201)).body as UploadResponse).id;
      await issue(cookie, recordId).expect(200);
      const detail = (await http().get(`/api/records/${recordId}`).set('Cookie', cookie).expect(200)).body as { videoId?: string };
      expect(detail.videoId).toBe(first);
    });
  });
});
