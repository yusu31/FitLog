import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createApp, migrateDb, resetDb, TEST_ORIGIN } from './helpers/app.js';

// 動画の一覧（GET /videos/week・GET /videos/mine・GET /feed の hasVideo。台帳 A14-2・A06-4）の結合テスト（本物の PostgreSQL・better-auth）。
// 閲覧条件は GET /videos/{id}/url と同じ（案B）: 仲間の動画は、今週に自分が1本撮った人だけ見える。一覧の locked と URL 発行の可否が食い違わないことを確かめる
const url = process.env.DATABASE_URL;
const OLD_RECORDED_AT = '2026-10-26T03:00:00.000Z';
const body = { contentType: 'video/mp4', sizeBytes: 1_500_000 };

const cookieOf = (res: request.Response): string => (res.headers['set-cookie'] as unknown as string[]).map((c) => c.split(';')[0]).join('; ');

type WeekItem = { id: string; recordId: string; recordedAt: string; visibleUntil: string; mine: boolean; author: { id: string; name: string } };
type WeekBody = { weekStart: string; unlocked: boolean; items: WeekItem[] };
type MineItem = { id: string; recordId: string; recordedAt: string; localDate: string; visibleUntil: string };
type MineBody = { items: MineItem[]; nextCursor: string | null };

describe('動画の一覧（結合: 本物の PostgreSQL・better-auth）', () => {
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

  // 動画を1本撮る（筋トレの記録＋動画の行）。recordedAt の既定は今（= 今週）。動画の id と記録の id を返す
  const shoot = async (cookie: string, recordedAt = new Date().toISOString()): Promise<{ videoId: string; recordId: string }> => {
    const recordId = randomUUID();
    await http().post('/api/records').set('Cookie', cookie).send({ id: recordId, kind: 'workout', recordedAt }).expect(201);
    const res = await http().post(`/api/records/${recordId}/video`).set('Cookie', cookie).send(body).expect(201);
    return { videoId: (res.body as { id: string }).id, recordId };
  };
  const week = async (cookie: string): Promise<WeekBody> => (await http().get('/api/videos/week').set('Cookie', cookie).expect(200)).body as WeekBody;
  const mine = (cookie: string, query = '') => http().get(`/api/videos/mine${query}`).set('Cookie', cookie);
  const viewUrl = (cookie: string, videoId: string) => http().get(`/api/videos/${videoId}/url`).set('Cookie', cookie);

  const makeGroup = async (ownerName: string, memberNames: string[]): Promise<string[]> => {
    const owner = await signUpAs(ownerName);
    await http().post('/api/groups').set('Cookie', owner).send({ name: `グループ${ownerName}` }).expect(201);
    const cookies = [owner];
    for (const name of memberNames) {
      const { token } = (await http().post('/api/groups/current/invitations').set('Cookie', owner).expect(201)).body as { token: string };
      const c = await signUpAs(name);
      await http().post(`/api/invitations/${token}/accept`).set('Cookie', c).expect(200);
      cookies.push(c);
    }
    return cookies;
  };

  describe('GET /videos/week（今週の動画の一覧）', () => {
    it('Cookie なしでは 401', async () => {
      await http().get('/api/videos/week').expect(401);
    });

    it('自分が今週まだ撮っていないと、仲間の動画は locked（unlocked=false）で出る。URL の発行も 403 VIDEO_LOCKED で、一覧と食い違わない', async () => {
      const [a, b] = await makeGroup('A1', ['A2']);
      const { videoId, recordId } = await shoot(a!);
      const res = await week(b!);
      expect(res.unlocked).toBe(false);
      expect(res.items).toHaveLength(1);
      expect(res.items[0]).toMatchObject({ id: videoId, recordId, mine: false, author: { name: 'A1' } });
      const locked = await viewUrl(b!, videoId).expect(403);
      expect((locked.body as { code: string }).code).toBe('VIDEO_LOCKED');
    });

    it('自分が今週1本撮ると unlocked=true になり、仲間の動画の URL が出る（撮った人だけ見える）', async () => {
      const [a, b] = await makeGroup('A1', ['A2']);
      const { videoId } = await shoot(a!);
      await shoot(b!);
      const res = await week(b!);
      expect(res.unlocked).toBe(true);
      expect(res.items.filter((i) => i.mine)).toHaveLength(1);
      expect(res.items.filter((i) => !i.mine)).toHaveLength(1);
      await viewUrl(b!, videoId).expect(200);
    });

    it('自分の動画は条件なしで一覧に出て、mine=true。仲間が撮っていなくても URL が出る', async () => {
      const [a] = await makeGroup('A1', ['A2']);
      const { videoId } = await shoot(a!);
      const res = await week(a!);
      expect(res.unlocked).toBe(true);
      expect(res.items).toHaveLength(1);
      expect(res.items[0]).toMatchObject({ id: videoId, mine: true });
      await viewUrl(a!, videoId).expect(200);
    });

    it('先週の動画は出ない（週が替わったらまた撮る）。先週に撮っただけの人は unlocked=false', async () => {
      const [a, b] = await makeGroup('A1', ['A2']);
      await shoot(a!, OLD_RECORDED_AT);
      await shoot(b!, OLD_RECORDED_AT);
      const res = await week(b!);
      expect(res.items).toEqual([]);
      expect(res.unlocked).toBe(false);
    });

    it('別のグループの人の動画は出ない。グループに入っていない人は自分の分だけ', async () => {
      const [a] = await makeGroup('A1', ['A2']);
      const [x] = await makeGroup('X1', []);
      const solo = await signUpAs('S1');
      const { videoId: otherId } = await shoot(x!);
      await shoot(a!);
      expect((await week(a!)).items.every((i) => i.id !== otherId)).toBe(true);
      expect((await week(solo)).items).toEqual([]);
      await shoot(solo);
      const soloRes = await week(solo);
      expect(soloRes.items).toHaveLength(1);
      expect(soloRes.items[0]!.mine).toBe(true);
      // 他グループの動画は URL も 404（一覧に出ないだけでなく、発行もされない）
      await viewUrl(a!, otherId).expect(404);
    });

    it('一覧のどの項目も、locked なら URL は 403・見えるなら 200（条件の境目が一覧と URL 発行で一致）', async () => {
      const [a, b, c] = await makeGroup('A1', ['A2', 'A3']);
      await shoot(a!);
      await shoot(b!);
      for (const [cookie, unlocked] of [[c!, false], [a!, true]] as const) {
        const res = await week(cookie);
        expect(res.unlocked).toBe(unlocked);
        expect(res.items.length).toBeGreaterThan(0);
        for (const item of res.items) {
          await viewUrl(cookie, item.id).expect(item.mine || res.unlocked ? 200 : 403);
        }
      }
    });
  });

  describe('GET /videos/mine（自分の過去の動画）', () => {
    it('Cookie なしでは 401', async () => {
      await http().get('/api/videos/mine').expect(401);
    });

    it('自分の動画だけが、先週以前も含めて出る（仲間の動画は出ない）。条件なし（今週撮っていなくても出る・URL も取れる）', async () => {
      const [a, b] = await makeGroup('A1', ['A2']);
      const old = await shoot(a!, OLD_RECORDED_AT);
      await shoot(b!);
      const res = (await mine(a!).expect(200)).body as MineBody;
      expect(res.items.map((i) => i.id)).toEqual([old.videoId]);
      expect(res.items[0]).toMatchObject({ recordId: old.recordId, localDate: '2026-10-26', visibleUntil: '2026-11-01T15:00:00.000Z' });
      expect(res.nextCursor).toBeNull();
      await viewUrl(a!, old.videoId).expect(200);
    });

    it('20 件ずつ・新しい順。21 本あると nextCursor が出て、続きで残り1本が重複なく取れる', async () => {
      const a = await signUpAs('A1');
      const ids: string[] = [];
      for (let i = 0; i < 21; i++) ids.push((await shoot(a, new Date(Date.UTC(2026, 9, 1, 0, i)).toISOString())).videoId);
      const first = (await mine(a).expect(200)).body as MineBody;
      expect(first.items).toHaveLength(20);
      expect(first.nextCursor).not.toBeNull();
      const second = (await mine(a, `?cursor=${first.nextCursor}`).expect(200)).body as MineBody;
      expect(second.items).toHaveLength(1);
      expect(second.nextCursor).toBeNull();
      expect([...first.items, ...second.items].map((i) => i.id)).toEqual(ids.toReversed());
    });

    it('壊れた cursor は 400 VALIDATION_ERROR', async () => {
      const a = await signUpAs('A1');
      const res = await mine(a, '?cursor=xxx').expect(400);
      expect((res.body as { code: string }).code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /feed の hasVideo（A06-4）', () => {
    it('動画のある記録だけ hasVideo=true。ない記録は項目ごと省く', async () => {
      const [a, b] = await makeGroup('A1', ['A2']);
      const withVideo = await shoot(a!);
      const plain = randomUUID();
      await http().post('/api/records').set('Cookie', a!).send({ id: plain, kind: 'workout', recordedAt: new Date().toISOString() }).expect(201);
      // API は日本時間の日付で週を決める。UTC の日付だと、日本の月曜の朝（UTC は日曜）に今日の記録が前の週になる
      const feed = (await http().get(`/api/feed?weekStart=${new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)}`).set('Cookie', b!).expect(200)).body as { items: { id: string; hasVideo?: boolean; videoId?: string; videoVisibleUntil?: string }[] };
      expect(feed.items.find((i) => i.id === withVideo.recordId)?.hasVideo).toBe(true);
      expect(feed.items.find((i) => i.id === withVideo.recordId)?.videoId).toBe(withVideo.videoId);
      expect(typeof feed.items.find((i) => i.id === withVideo.recordId)?.videoVisibleUntil).toBe('string');
      expect(feed.items.find((i) => i.id === plain)).toBeDefined();
      expect(feed.items.find((i) => i.id === plain)?.hasVideo).toBeUndefined();
      expect(feed.items.find((i) => i.id === plain)?.videoId).toBeUndefined();
    });
  });
});
