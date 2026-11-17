import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { S3VideoStorage } from '../src/videos/video-storage.js';
import { createApp, migrateDb, resetDb, TEST_ORIGIN, withPool } from './helpers/app.js';

// 退会（F2-b。POST /api/auth/delete-user）の結合テスト。本物の PostgreSQL・本物の better-auth。
// 本人の決定: 自分の記録・動画・仲間の記録に付けた自分のコメントとスタンプは全部消す。確認画面＋パスワードで即削除（猶予なし）。
// 消えてはいけないもの: 仲間の記録・グループ・一覧の種目（created_by が NULL）
const url = process.env.DATABASE_URL;
const PASSWORD = 'correct-horse-battery';
const MON_NOON = '2026-10-26T03:00:00.000Z';
const BENCH_PRESS_ID = '00000000-0000-4000-8000-000000000001';

const cookieOf = (res: request.Response): string =>
  (res.headers['set-cookie'] as unknown as string[]).map((c) => c.split(';')[0]).join('; ');

describe('退会（結合: 本物の PostgreSQL・better-auth）', () => {
  let app: INestApplication;

  beforeAll(async () => {
    if (!url) throw new Error('DATABASE_URL が設定されていません');
    await migrateDb(process.env.MIGRATION_DATABASE_URL ?? url);
  });

  beforeEach(async () => {
    process.env.VIDEO_BUCKET = 'fitlog-test-bucket';
    await resetDb(url!);
    app = await createApp(url);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    delete process.env.VIDEO_BUCKET;
    await app?.close();
  });

  const http = () => request(app.getHttpServer());
  const rows = <T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> =>
    withPool(url!, async (pool) => (await pool.query(sql, params)).rows as T[]);
  const count = async (table: string): Promise<number> => Number((await rows<{ n: string }>(`SELECT count(*) AS n FROM ${table}`))[0].n);

  let seq = 0;
  const signUpAs = async (name: string): Promise<{ cookie: string; id: string }> => {
    const res = await http()
      .post('/api/auth/sign-up/email')
      .set('Origin', TEST_ORIGIN)
      .send({ email: `del${++seq}@example.com`, password: PASSWORD, name })
      .expect(200);
    return { cookie: cookieOf(res), id: (res.body as { user: { id: string } }).user.id };
  };

  const createRecord = async (cookie: string): Promise<string> => {
    const id = randomUUID();
    await http().post('/api/records').set('Cookie', cookie).send({ id, kind: 'workout', recordedAt: MON_NOON }).expect(201);
    await http()
      .post(`/api/records/${id}/sets`)
      .set('Cookie', cookie)
      .send({ id: randomUUID(), exerciseId: BENCH_PRESS_ID, setNo: 1, weightKg: 40, reps: 10 })
      .expect(201);
    return id;
  };

  const deleteAccount = (cookie: string, body: Record<string, unknown> = { password: PASSWORD }) =>
    http().post('/api/auth/delete-user').set('Origin', TEST_ORIGIN).set('Cookie', cookie).send(body);

  // 世界: leaver（退会する人）と friend が同じグループ。それぞれ記録があり、互いにスタンプ・コメントを付けている。
  // leaver は自分の種目・ルーティン・動画を持ち、friend の記録は leaver の記録からコピーしたもの
  const world = async () => {
    const leaver = await signUpAs('りたいやく');
    await http().post('/api/groups').set('Cookie', leaver.cookie).send({ name: '朝トレ部' }).expect(201);
    const { token } = (await http().post('/api/groups/current/invitations').set('Cookie', leaver.cookie).expect(201)).body as { token: string };
    const friend = await signUpAs('ともだち');
    await http().post(`/api/invitations/${token}/accept`).set('Cookie', friend.cookie).expect(200);

    const leaverRecord = await createRecord(leaver.cookie);
    const friendRecord = await createRecord(friend.cookie);

    await http().post(`/api/records/${friendRecord}/reactions`).set('Cookie', leaver.cookie).send({ id: randomUUID(), stampKey: 'nice' }).expect(201);
    await http().post(`/api/records/${friendRecord}/comments`).set('Cookie', leaver.cookie).send({ id: randomUUID(), body: 'ナイス！' }).expect(201);
    await http().post(`/api/records/${leaverRecord}/reactions`).set('Cookie', friend.cookie).send({ id: randomUUID(), stampKey: 'clap' }).expect(201);
    await http().post(`/api/records/${leaverRecord}/comments`).set('Cookie', friend.cookie).send({ id: randomUUID(), body: 'おつかれ' }).expect(201);

    await http().post('/api/routines').set('Cookie', leaver.cookie).send({ name: '胸の日', recordId: leaverRecord }).expect(201);
    await withPool(url!, async (pool) => {
      await pool.query(`INSERT INTO exercises (name, body_part, created_by) SELECT 'じぶん種目', body_part, $1 FROM exercises LIMIT 1`, [leaver.id]);
      await pool.query(
        `INSERT INTO videos (record_id, s3_key, content_type, size_bytes, visible_until) VALUES ($1, $2, 'video/mp4', 1000, now() + interval '1 day')`,
        [leaverRecord, `videos/${leaverRecord}`],
      );
      await pool.query('UPDATE records SET copied_from_user_id = $1 WHERE id = $2', [leaver.id, friendRecord]);
    });
    return { leaver, friend, leaverRecord, friendRecord };
  };

  it('退会すると、本人の記録・スタンプ・コメント・ルーティン・自分の種目・ログインが全部消え、仲間のものは残る', async () => {
    const deleteMany = vi.spyOn(S3VideoStorage.prototype, 'deleteMany').mockResolvedValue(undefined);
    const { leaver, friend, leaverRecord, friendRecord } = await world();

    await deleteAccount(leaver.cookie).expect(200);

    // 本人の分は全部消える
    expect(await rows('SELECT 1 FROM users WHERE id = $1', [leaver.id])).toHaveLength(0);
    expect(await rows('SELECT 1 FROM records WHERE user_id = $1', [leaver.id])).toHaveLength(0);
    expect(await rows('SELECT 1 FROM workout_sets WHERE record_id = $1', [leaverRecord])).toHaveLength(0);
    expect(await rows('SELECT 1 FROM videos WHERE record_id = $1', [leaverRecord])).toHaveLength(0);
    expect(await rows('SELECT 1 FROM reactions WHERE user_id = $1', [leaver.id])).toHaveLength(0);
    expect(await rows('SELECT 1 FROM comments WHERE user_id = $1', [leaver.id])).toHaveLength(0);
    expect(await count('routines')).toBe(0);
    expect(await count('routine_sets')).toBe(0);
    expect(await rows('SELECT 1 FROM exercises WHERE created_by = $1', [leaver.id])).toHaveLength(0);
    expect(await rows('SELECT 1 FROM sessions WHERE user_id = $1', [leaver.id])).toHaveLength(0);
    expect(await rows('SELECT 1 FROM accounts WHERE user_id = $1', [leaver.id])).toHaveLength(0);
    expect(await rows('SELECT 1 FROM group_members WHERE user_id = $1', [leaver.id])).toHaveLength(0);
    // 仲間の分・グループ・一覧の種目は残る。仲間の記録の「コピー元」だけ空になる
    expect(await rows('SELECT 1 FROM users WHERE id = $1', [friend.id])).toHaveLength(1);
    const friendRows = await rows<{ copied_from_user_id: string | null }>('SELECT copied_from_user_id FROM records WHERE id = $1', [friendRecord]);
    expect(friendRows).toEqual([{ copied_from_user_id: null }]);
    expect(await rows('SELECT 1 FROM workout_sets WHERE record_id = $1', [friendRecord])).toHaveLength(1);
    expect(await rows('SELECT 1 FROM group_members WHERE user_id = $1', [friend.id])).toHaveLength(1);
    const groupRows = await rows<{ created_by: string | null }>('SELECT created_by FROM groups');
    expect(groupRows).toEqual([{ created_by: null }]);
    expect(Number((await rows<{ n: string }>('SELECT count(*) AS n FROM exercises WHERE created_by IS NULL'))[0].n)).toBeGreaterThan(20);
    // 動画の S3 ファイルも消しに行く
    expect(deleteMany).toHaveBeenCalledWith([`videos/${leaverRecord}`]);
    // 同じ Cookie も、同じパスワードでのログインも使えない
    await http().get('/api/health/db').set('Cookie', leaver.cookie).expect(401);
    await http().post('/api/auth/sign-in/email').set('Origin', TEST_ORIGIN).send({ email: 'del1@example.com', password: PASSWORD }).expect(401);
  });

  it('パスワードが違うと消えない。パスワードを送らなくても消えない（ログイン直後でも）', async () => {
    const { leaver } = await world();
    expect((await deleteAccount(leaver.cookie, { password: 'wrong-password-123' })).status).toBeGreaterThanOrEqual(400);
    expect((await deleteAccount(leaver.cookie, {})).status).toBe(400);
    expect(await rows('SELECT 1 FROM users WHERE id = $1', [leaver.id])).toHaveLength(1);
    expect(await count('records')).toBe(2);
    await http().get('/api/health/db').set('Cookie', leaver.cookie).expect(200);
  });

  it('知らない Origin からの退会は 403 で、何も消えない', async () => {
    const { leaver } = await world();
    await http().post('/api/auth/delete-user').set('Origin', 'https://evil.example').set('Cookie', leaver.cookie).send({ password: PASSWORD }).expect(403);
    expect(await rows('SELECT 1 FROM users WHERE id = $1', [leaver.id])).toHaveLength(1);
  });

  it('動画ファイルの削除に失敗しても、アカウントは消える（置き場の不具合で退会できなくならない）', async () => {
    vi.spyOn(S3VideoStorage.prototype, 'deleteMany').mockRejectedValue(new Error('AccessDenied'));
    const { leaver } = await world();
    await deleteAccount(leaver.cookie).expect(200);
    expect(await rows('SELECT 1 FROM users WHERE id = $1', [leaver.id])).toHaveLength(0);
    expect(await rows('SELECT 1 FROM records WHERE user_id = $1', [leaver.id])).toHaveLength(0);
  });

  it('グループの最後の1人が退会しても、エラーにならない', async () => {
    const solo = await signUpAs('ひとり');
    await http().post('/api/groups').set('Cookie', solo.cookie).send({ name: 'ひとりぶ' }).expect(201);
    await deleteAccount(solo.cookie).expect(200);
    expect(await count('users')).toBe(0);
  });
});
