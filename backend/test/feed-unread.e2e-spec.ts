import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createApp, migrateDb, resetDb, TEST_ORIGIN } from './helpers/app.js';

// 仲間タブの新着の印（F4）。GET /feed/unread・POST /feed/seen・GET /feed の isNew の結合テスト。
// 基準は users.feed_seen_at（最後に仲間タブを見た時刻）。一度も見ていない人は登録した時刻を基準にする。
// 新着になるもの: ①同じグループの「自分以外の人」の記録で、基準より後に作られたもの
//               ②自分の記録に「自分以外の人」が基準より後に付けたスタンプ・コメント
// 本物の PostgreSQL・本物の better-auth。DATABASE_URL が無ければ「落ちる」（飛ばさない）
const url = process.env.DATABASE_URL;

const cookieOf = (res: request.Response): string =>
  (res.headers['set-cookie'] as unknown as string[]).map((c) => c.split(';')[0]).join('; ');

// 2026-10-26（月曜）の週。日本時間 12:00
const WEEK = '2026-10-26';
const MON_NOON = '2026-10-26T03:00:00.000Z';
const LAST_WEEK_NOON = '2026-10-19T03:00:00.000Z';

describe('仲間タブの新着の印（結合: 本物の PostgreSQL・better-auth）', () => {
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

  const http = () => request(app.getHttpServer());

  let userSeq = 0;
  const signUpAs = async (name: string): Promise<string> => {
    const res = await http()
      .post('/api/auth/sign-up/email')
      .set('Origin', TEST_ORIGIN)
      .send({ email: `fu${++userSeq}@example.com`, password: 'correct-horse-battery', name })
      .expect(200);
    return cookieOf(res);
  };

  const groupWith = async (members: number, label: string): Promise<string[]> => {
    const cookies = [await signUpAs(`${label}1`)];
    await http().post('/api/groups').set('Cookie', cookies[0]).send({ name: `グループ${label}` }).expect(201);
    const { token } = (await http().post('/api/groups/current/invitations').set('Cookie', cookies[0]).expect(201)).body as { token: string };
    for (let i = 1; i < members; i++) {
      const c = await signUpAs(`${label}${i + 1}`);
      await http().post(`/api/invitations/${token}/accept`).set('Cookie', c).expect(200);
      cookies.push(c);
    }
    return cookies;
  };

  const createRecord = async (cookie: string, recordedAt = MON_NOON): Promise<string> => {
    const id = randomUUID();
    await http().post('/api/records').set('Cookie', cookie).send({ id, kind: 'workout', recordedAt }).expect(201);
    return id;
  };

  const hasNew = async (cookie: string): Promise<boolean> => {
    const res = await http().get('/api/feed/unread').set('Cookie', cookie).expect(200);
    return (res.body as { hasNew: boolean }).hasNew;
  };

  const markSeen = async (cookie: string): Promise<void> => {
    await http().post('/api/feed/seen').set('Cookie', cookie).expect(204);
  };

  const feedItems = async (cookie: string): Promise<Array<{ id: string; isNew?: boolean }>> => {
    const res = await http().get('/api/feed').query({ weekStart: WEEK }).set('Cookie', cookie).expect(200);
    return (res.body as { items: Array<{ id: string; isNew?: boolean }> }).items;
  };

  it('T-UNREAD-01: 仲間が記録すると新着あり。見たら新着なし。そのあと仲間が記録するとまた新着あり', async () => {
    const [a1, a2] = await groupWith(2, 'A');
    expect(await hasNew(a2)).toBe(false);

    await createRecord(a1);
    expect(await hasNew(a2)).toBe(true);

    await markSeen(a2);
    expect(await hasNew(a2)).toBe(false);

    await createRecord(a1);
    expect(await hasNew(a2)).toBe(true);
  });

  it('T-UNREAD-02: 自分の記録・別のグループの人の記録は、新着にならない', async () => {
    const [a1, a2] = await groupWith(2, 'A');
    const [b1] = await groupWith(2, 'B');
    await createRecord(a2);
    await createRecord(b1);
    expect(await hasNew(a2)).toBe(false);
    void a1;
  });

  it('T-UNREAD-03: 自分の記録に仲間がスタンプ・コメントを付けると新着あり。自分で付けたものは新着にならない', async () => {
    const [a1, a2] = await groupWith(2, 'A');
    const mine = await createRecord(a1);
    await markSeen(a1);

    await http().post(`/api/records/${mine}/reactions`).set('Cookie', a1).send({ id: randomUUID(), stampKey: 'nice' }).expect(201);
    await http().post(`/api/records/${mine}/comments`).set('Cookie', a1).send({ id: randomUUID(), body: '自分で' }).expect(201);
    expect(await hasNew(a1)).toBe(false);

    await http().post(`/api/records/${mine}/reactions`).set('Cookie', a2).send({ id: randomUUID(), stampKey: 'fire' }).expect(201);
    expect(await hasNew(a1)).toBe(true);

    await markSeen(a1);
    expect(await hasNew(a1)).toBe(false);
    await http().post(`/api/records/${mine}/comments`).set('Cookie', a2).send({ id: randomUUID(), body: 'ナイス' }).expect(201);
    expect(await hasNew(a1)).toBe(true);
  });

  it('T-UNREAD-04: 足跡の isNew は、新しく来た仲間の記録と、仲間の新しい反応が付いた自分の記録だけに付く', async () => {
    const [a1, a2] = await groupWith(2, 'A');
    const oldOfA1 = await createRecord(a1);
    const mineOfA2 = await createRecord(a2);
    await markSeen(a2);
    const newOfA1 = await createRecord(a1);
    await http().post(`/api/records/${mineOfA2}/reactions`).set('Cookie', a1).send({ id: randomUUID(), stampKey: 'clap' }).expect(201);

    const items = await feedItems(a2);
    const isNewOf = (id: string) => items.find((i) => i.id === id)?.isNew === true;
    expect(items).toHaveLength(3);
    expect(isNewOf(newOfA1)).toBe(true);
    expect(isNewOf(mineOfA2)).toBe(true);
    expect(isNewOf(oldOfA1)).toBe(false);
  });

  it('T-UNREAD-05: 足跡を読んでも見た時刻は進まない（POST /feed/seen を呼んだときだけ進む）', async () => {
    const [a1, a2] = await groupWith(2, 'A');
    const id = await createRecord(a1);
    expect((await feedItems(a2)).find((i) => i.id === id)?.isNew).toBe(true);
    expect((await feedItems(a2)).find((i) => i.id === id)?.isNew).toBe(true);
    expect(await hasNew(a2)).toBe(true);
  });

  it('T-UNREAD-06: 前の週の日付であとから記録したものも、新しく作られたので新着あり', async () => {
    const [a1, a2] = await groupWith(2, 'A');
    await markSeen(a2);
    await createRecord(a1, LAST_WEEK_NOON);
    expect(await hasNew(a2)).toBe(true);
  });

  it('T-UNREAD-07: グループに入っていない人は、いつも新着なし。ログインしていなければ 401', async () => {
    const n1 = await signUpAs('なし');
    expect(await hasNew(n1)).toBe(false);
    await markSeen(n1);
    await http().get('/api/feed/unread').expect(401);
    await http().post('/api/feed/seen').expect(401);
  });
});
