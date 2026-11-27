import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { S3VideoStorage } from '../src/videos/video-storage.js';
import { createApp, migrateDb, resetDb, TEST_ORIGIN, withPool } from './helpers/app.js';

// 投稿（kind=post）・ひとこと（caption）・動画だけ消す・記録を消すと S3 も消す（PR 4）の結合テスト（本物の PostgreSQL・better-auth）。
// S3 は本物に触らない（deleteMany を差し替えて、呼ばれたキーだけ確かめる）
const url = process.env.DATABASE_URL;
const MON_NOON = '2026-10-26T03:00:00.000Z'; // 月曜の昼（日本時間）
const TUE_NOON = '2026-10-27T03:00:00.000Z';
const WEEK = '2026-10-26';

const cookieOf = (res: request.Response): string => (res.headers['set-cookie'] as unknown as string[]).map((c) => c.split(';')[0]).join('; ');

describe('投稿・ひとこと・動画の削除（結合: 本物の PostgreSQL・better-auth）', () => {
  let app: INestApplication;
  let deleteMany: ReturnType<typeof vi.spyOn>;

  beforeAll(async () => {
    if (!url) throw new Error('DATABASE_URL が設定されていません');
    process.env.VIDEO_BUCKET = 'fitlog-test-bucket';
    process.env.AWS_ACCESS_KEY_ID = 'AKIAFAKEFAKEFAKE';
    process.env.AWS_SECRET_ACCESS_KEY = 'fake-secret';
    await migrateDb(process.env.MIGRATION_DATABASE_URL ?? url);
  });
  beforeEach(async () => {
    await resetDb(url!);
    deleteMany = vi.spyOn(S3VideoStorage.prototype, 'deleteMany').mockResolvedValue(undefined);
    app = await createApp(url);
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    await app?.close();
  });

  const http = () => request(app.getHttpServer());
  let seq = 0;
  const signUpAs = async (name: string): Promise<string> =>
    cookieOf(await http().post('/api/auth/sign-up/email').set('Origin', TEST_ORIGIN).send({ email: `post${++seq}@example.com`, password: 'correct-horse-battery', name }).expect(200));
  const createPost = async (cookie: string, extra: object = {}, recordedAt = MON_NOON): Promise<string> => {
    const id = randomUUID();
    await http().post('/api/records').set('Cookie', cookie).send({ id, kind: 'post', recordedAt, ...extra }).expect(201);
    return id;
  };
  const createRecord = async (cookie: string, kind: 'workout' | 'rest', recordedAt = MON_NOON): Promise<string> => {
    const id = randomUUID();
    await http().post('/api/records').set('Cookie', cookie).send({ id, kind, recordedAt }).expect(201);
    return id;
  };
  const attachVideo = (cookie: string, recordId: string) => http().post(`/api/records/${recordId}/video`).set('Cookie', cookie).send({ contentType: 'video/mp4', sizeBytes: 1_000_000 }).expect(201);
  const rows = <T>(sql: string, params: unknown[] = []): Promise<T[]> => withPool(url!, async (pool) => (await pool.query(sql, params)).rows as T[]);

  describe('投稿（kind=post）とひとこと（caption）', () => {
    it('投稿をひとこと付きで作れる。応答と詳細に caption が付く', async () => {
      const cookie = await signUpAs('me');
      const id = await createPost(cookie, { caption: '  ジム前のひとこと  ' });
      const res = await http().get(`/api/records/${id}`).set('Cookie', cookie).expect(200);
      expect(res.body).toMatchObject({ id, kind: 'post', caption: 'ジム前のひとこと' });
    });

    it('ひとこと無しの投稿も作れ、caption は付かない。空白だけも同じ', async () => {
      const cookie = await signUpAs('me');
      for (const extra of [{}, { caption: '   ' }]) {
        const id = await createPost(cookie, extra);
        const res = await http().get(`/api/records/${id}`).set('Cookie', cookie).expect(200);
        expect(res.body).not.toHaveProperty('caption');
      }
    });

    it('ひとこと 50字ちょうどは通り、51字・文字列でない値は 400（数え方はコードポイント）', async () => {
      const cookie = await signUpAs('me');
      await createPost(cookie, { caption: 'あ'.repeat(50) });
      await createPost(cookie, { caption: '😀'.repeat(50) });
      for (const caption of ['あ'.repeat(51), '😀'.repeat(51), 123]) {
        const res = await http().post('/api/records').set('Cookie', cookie).send({ id: randomUUID(), kind: 'post', recordedAt: MON_NOON, caption }).expect(400);
        expect((res.body as { code: string }).code).toBe('VALIDATION_ERROR');
      }
    });

    it('PATCH /records/{id}/memo で caption を付け直せる。null で消せる。51字は 400', async () => {
      const cookie = await signUpAs('me');
      const id = await createRecord(cookie, 'workout');
      const set = await http().patch(`/api/records/${id}/memo`).set('Cookie', cookie).send({ caption: 'いい汗' }).expect(200);
      expect(set.body).toEqual({ note: null, rpe: null, caption: 'いい汗' });
      await http().patch(`/api/records/${id}/memo`).set('Cookie', cookie).send({ caption: 'あ'.repeat(51) }).expect(400);
      const cleared = await http().patch(`/api/records/${id}/memo`).set('Cookie', cookie).send({ caption: null }).expect(200);
      expect(cleared.body).toMatchObject({ caption: null });
    });

    it('仲間のタイムライン（GET /feed）には caption が見える（note と違い仲間にも返す）', async () => {
      const a = await signUpAs('A1');
      await http().post('/api/groups').set('Cookie', a).send({ name: 'グループA' }).expect(201);
      const { token } = (await http().post('/api/groups/current/invitations').set('Cookie', a).expect(201)).body as { token: string };
      const b = await signUpAs('A2');
      await http().post(`/api/invitations/${token}/accept`).set('Cookie', b).expect(200);
      const id = await createPost(a, { caption: 'みてね' });
      const feed = await http().get('/api/feed').query({ weekStart: WEEK }).set('Cookie', b).expect(200);
      expect((feed.body as { items: Array<{ id: string; kind: string; caption?: string }> }).items.find((i) => i.id === id)).toMatchObject({ kind: 'post', caption: 'みてね' });
    });

    it('あとから記録（late）の投稿もひとこと付きで作れる（動画は付けられない）', async () => {
      const cookie = await signUpAs('me');
      const id = await createPost(cookie, { late: true, caption: 'あとから' });
      await http().post(`/api/records/${id}/video`).set('Cookie', cookie).send({ contentType: 'video/mp4', sizeBytes: 1000 }).expect(409);
    });
  });

  describe('投稿は運動として数えない', () => {
    it('7マス: 投稿だけの日は none のまま（rec にも rest にもならない）', async () => {
      const cookie = await signUpAs('me');
      await createPost(cookie, {}, TUE_NOON);
      const res = await http().get('/api/week').query({ date: WEEK }).set('Cookie', cookie).expect(200);
      const tue = (res.body as { days: Array<{ date: string; status: string }> }).days.find((d) => d.date === '2026-10-27');
      expect(tue?.status).toBe('none');
    });

    it('投稿を作っても、同じ日の休みは消えない（筋トレ・ランなら消える）', async () => {
      const cookie = await signUpAs('me');
      await createRecord(cookie, 'rest');
      await createPost(cookie);
      expect(await rows('SELECT 1 FROM records WHERE kind = $1', ['rest'])).toHaveLength(1);
      await createRecord(cookie, 'workout');
      expect(await rows('SELECT 1 FROM records WHERE kind = $1', ['rest'])).toHaveLength(0);
    });

    it('統計: 投稿だけの人は、動いた日・今月の回数・スタンプが 0 のまま。投稿のある日を「最初の記録の日」にしない', async () => {
      const cookie = await signUpAs('me');
      await createPost(cookie, {}, MON_NOON);
      const res = await http().get('/api/me/stats').query({ date: '2026-10-28' }).set('Cookie', cookie).expect(200);
      const body = res.body as { month: { activeDays: number; restDays: number }; stamps: Array<{ key: string; earned: boolean }> };
      expect(body.month.activeDays).toBe(0);
      expect(body.month.restDays).toBe(0); // 投稿の日を最初の記録の日にすると、月曜〜きのうが自動の休みになってしまう
      expect(body.stamps.filter((s) => s.earned)).toHaveLength(0);
    });

    it('仲間の合計: 投稿だけの人は「記録した人数」に入らない', async () => {
      const a = await signUpAs('A1');
      await http().post('/api/groups').set('Cookie', a).send({ name: 'グループA' }).expect(201);
      await createPost(a);
      const feed = await http().get('/api/feed').query({ weekStart: WEEK }).set('Cookie', a).expect(200);
      expect((feed.body as { totals: { recordedUserCount: number } }).totals.recordedUserCount).toBe(0);
    });

    it('投稿にも通常のスタンプ（休み用でない）を付けられる', async () => {
      const a = await signUpAs('A1');
      await http().post('/api/groups').set('Cookie', a).send({ name: 'グループA' }).expect(201);
      const { token } = (await http().post('/api/groups/current/invitations').set('Cookie', a).expect(201)).body as { token: string };
      const b = await signUpAs('A2');
      await http().post(`/api/invitations/${token}/accept`).set('Cookie', b).expect(200);
      const id = await createPost(a);
      await http().post(`/api/records/${id}/reactions`).set('Cookie', b).send({ id: randomUUID(), stampKey: 'nice' }).expect(201);
      const bad = await http().post(`/api/records/${id}/reactions`).set('Cookie', b).send({ id: randomUUID(), stampKey: 'rest_slow' });
      expect(bad.status).toBe(409);
    });
  });

  describe('DELETE /records/{id}/video（動画だけ消す）', () => {
    it('Cookie なしは 401', async () => {
      await http().delete(`/api/records/${randomUUID()}/video`).expect(401);
    });

    it('投稿の動画を消すと、投稿ごと消える（recordDeleted=true）。S3 のファイルも消す', async () => {
      const cookie = await signUpAs('me');
      const id = await createPost(cookie, { caption: 'ひとこと' });
      await attachVideo(cookie, id);
      const res = await http().delete(`/api/records/${id}/video`).set('Cookie', cookie).expect(200);
      expect(res.body).toEqual({ recordDeleted: true });
      expect(await rows('SELECT 1 FROM records WHERE id = $1', [id])).toHaveLength(0);
      expect(await rows('SELECT 1 FROM videos')).toHaveLength(0);
      expect(deleteMany).toHaveBeenCalledWith([`videos/${id}`]);
    });

    it('筋トレの動画を消すと、動画だけ消えて記録は残る（recordDeleted=false）。あとで撮り直せる', async () => {
      const cookie = await signUpAs('me');
      const id = await createRecord(cookie, 'workout');
      await attachVideo(cookie, id);
      const res = await http().delete(`/api/records/${id}/video`).set('Cookie', cookie).expect(200);
      expect(res.body).toEqual({ recordDeleted: false });
      expect(await rows('SELECT 1 FROM records WHERE id = $1', [id])).toHaveLength(1);
      expect(await rows('SELECT 1 FROM videos')).toHaveLength(0);
      expect(deleteMany).toHaveBeenCalledWith([`videos/${id}`]);
      await attachVideo(cookie, id);
    });

    it('S3 の削除が失敗しても、削除は成功にする（置き場の不具合で消せなくならない）', async () => {
      deleteMany.mockRejectedValue(new Error('AccessDenied'));
      const cookie = await signUpAs('me');
      const id = await createRecord(cookie, 'workout');
      await attachVideo(cookie, id);
      await http().delete(`/api/records/${id}/video`).set('Cookie', cookie).expect(200);
      expect(await rows('SELECT 1 FROM videos')).toHaveLength(0);
    });

    it('動画の無い記録は 404 VIDEO_NOT_FOUND。他の人の記録・無い id・UUID でない id は 404 RECORD_NOT_FOUND', async () => {
      const a = await signUpAs('A1');
      const b = await signUpAs('A2');
      const id = await createRecord(a, 'workout');
      const none = await http().delete(`/api/records/${id}/video`).set('Cookie', a).expect(404);
      expect((none.body as { code: string }).code).toBe('VIDEO_NOT_FOUND');
      await attachVideo(a, id);
      for (const target of [id, randomUUID(), 'not-a-uuid']) {
        const res = await http().delete(`/api/records/${target}/video`).set('Cookie', b).expect(404);
        expect((res.body as { code: string }).code).toBe('RECORD_NOT_FOUND');
      }
      expect(await rows('SELECT 1 FROM videos')).toHaveLength(1);
    });
  });

  describe('記録を消すと S3 の動画も消す', () => {
    it('DELETE /records/{id}: 動画付きの記録を消すと、S3 のキーも消しに行く', async () => {
      const cookie = await signUpAs('me');
      const id = await createRecord(cookie, 'workout');
      await attachVideo(cookie, id);
      await http().delete(`/api/records/${id}`).set('Cookie', cookie).expect(204);
      expect(deleteMany).toHaveBeenCalledWith([`videos/${id}`]);
    });

    it('動画の無い記録を消しても S3 は呼ばない。S3 が失敗しても記録の削除は成功', async () => {
      const cookie = await signUpAs('me');
      const plain = await createRecord(cookie, 'workout');
      await http().delete(`/api/records/${plain}`).set('Cookie', cookie).expect(204);
      expect(deleteMany).not.toHaveBeenCalled();

      deleteMany.mockRejectedValue(new Error('AccessDenied'));
      const withVideo = await createRecord(cookie, 'rest', TUE_NOON);
      await attachVideo(cookie, withVideo);
      await http().delete(`/api/records/${withVideo}`).set('Cookie', cookie).expect(204);
      expect(await rows('SELECT 1 FROM records WHERE id = $1', [withVideo])).toHaveLength(0);
    });

    it('他の人の記録は消せず（404）、S3 も呼ばない', async () => {
      const a = await signUpAs('A1');
      const b = await signUpAs('A2');
      const id = await createRecord(a, 'workout');
      await attachVideo(a, id);
      await http().delete(`/api/records/${id}`).set('Cookie', b).expect(404);
      expect(deleteMany).not.toHaveBeenCalled();
    });
  });
});
