import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createApp, migrateDb, resetDb, TEST_ORIGIN } from './helpers/app.js';

// お知らせ（D7-3）。GET /notifications・POST /notifications/seen の結合テスト。
// 出るもの: ①自分の記録へのスタンプ・コメント ②同じグループの仲間の記録 ③仲間がグループに加わった
// 基準は users.notifications_seen_at（最後にお知らせを開いた時刻。無ければ登録した時刻）。
// 本物の PostgreSQL・本物の better-auth。DATABASE_URL が無ければ「落ちる」（飛ばさない）
const url = process.env.DATABASE_URL;

const cookieOf = (res: request.Response): string =>
  (res.headers['set-cookie'] as unknown as string[]).map((c) => c.split(';')[0]).join('; ');

type Item = { id: string; kind: string; unread: boolean; actor: { name: string }; recordId: string | null; recordKind: string | null; stampKey: string | null };
type Body = { unreadCount: number; items: Item[] };

describe('お知らせ（結合: 本物の PostgreSQL・better-auth）', () => {
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
      .send({ email: `nt${++userSeq}@example.com`, password: 'correct-horse-battery', name })
      .expect(200);
    return cookieOf(res);
  };

  // 1人目が作ったグループに、あとから仲間を足していける形
  const makeGroup = async (label: string) => {
    const owner = await signUpAs(`${label}1`);
    await http().post('/api/groups').set('Cookie', owner).send({ name: `グループ${label}` }).expect(201);
    const join = async (name: string): Promise<string> => {
      const { token } = (await http().post('/api/groups/current/invitations').set('Cookie', owner).expect(201)).body as { token: string };
      const c = await signUpAs(name);
      await http().post(`/api/invitations/${token}/accept`).set('Cookie', c).expect(200);
      return c;
    };
    return { owner, join };
  };

  const createRecord = async (cookie: string): Promise<string> => {
    const id = randomUUID();
    await http().post('/api/records').set('Cookie', cookie).send({ id, kind: 'workout', recordedAt: new Date().toISOString() }).expect(201);
    return id;
  };

  const list = async (cookie: string): Promise<Body> => (await http().get('/api/notifications').set('Cookie', cookie).expect(200)).body as Body;
  const markSeen = async (cookie: string): Promise<void> => {
    await http().post('/api/notifications/seen').set('Cookie', cookie).expect(204);
  };
  // 時刻の比較（now() と作成時刻）が同じ瞬間にならないよう、ごく短く待つ
  const tick = () => new Promise((r) => setTimeout(r, 30));

  it('T-NOTIF-01: グループに入っていなければ空。ログインしていなければ 401', async () => {
    const lonely = await signUpAs('ひとり');
    expect(await list(lonely)).toEqual({ unreadCount: 0, items: [] });
    await http().get('/api/notifications').expect(401);
    await http().post('/api/notifications/seen').expect(401);
  });

  it('T-NOTIF-02: 仲間が加わると「friend_joined」が出る。自分が加わったことは出ない', async () => {
    const { owner, join } = await makeGroup('A');
    await tick();
    await join('はなこ');
    const body = await list(owner);
    expect(body.items.map((i) => [i.kind, i.actor.name, i.recordId])).toEqual([['friend_joined', 'はなこ', null]]);
    expect(body.unreadCount).toBe(1);
  });

  it('T-NOTIF-03: 仲間の記録・自分の記録へのスタンプとコメントが、新しい順に並ぶ。自分の行動は出ない', async () => {
    const { owner, join } = await makeGroup('B');
    const hanako = await join('はなこ');
    await tick();
    const mineId = await createRecord(owner); // 自分の記録（自分の通知には出ない）
    await tick();
    const hanakoRecord = await createRecord(hanako); // 仲間の記録
    await tick();
    await http().post(`/api/records/${mineId}/reactions`).set('Cookie', hanako).send({ id: randomUUID(), stampKey: 'nice' }).expect(201);
    await tick();
    await http().post(`/api/records/${mineId}/comments`).set('Cookie', hanako).send({ id: randomUUID(), body: 'ナイス！' }).expect(201);

    const body = await list(owner);
    expect(body.items.map((i) => i.kind)).toEqual(['comment', 'stamp', 'friend_record', 'friend_joined']);
    const stamp = body.items.find((i) => i.kind === 'stamp')!;
    expect(stamp).toMatchObject({ stampKey: 'nice', recordId: mineId, recordKind: 'workout', actor: { name: 'はなこ' } });
    expect(body.items.find((i) => i.kind === 'friend_record')).toMatchObject({ recordId: hanakoRecord, actor: { name: 'はなこ' } });
    expect(body.unreadCount).toBe(4);

    // はなこ側には、自分の行動（スタンプ・コメント）は出ず、仲間（owner）の記録が出る
    const hanakoBody = await list(hanako);
    expect(hanakoBody.items.map((i) => i.kind)).toEqual(['friend_record']);
    expect(hanakoBody.items[0].actor.name).toBe('B1');
  });

  it('T-NOTIF-04: 見たら未読が0になり、そのあとの新しいお知らせだけが未読になる', async () => {
    const { owner, join } = await makeGroup('C');
    const hanako = await join('はなこ');
    await tick();
    await createRecord(hanako);
    expect((await list(owner)).unreadCount).toBe(2); // 加わった・記録した

    await tick();
    await markSeen(owner);
    await markSeen(owner); // 何度呼んでもよい
    const after = await list(owner);
    expect(after.unreadCount).toBe(0);
    expect(after.items.every((i) => !i.unread)).toBe(true);
    expect(after.items).toHaveLength(2); // 見た分も一覧には残る

    await tick();
    await createRecord(hanako);
    const again = await list(owner);
    expect(again.unreadCount).toBe(1);
    expect(again.items[0]).toMatchObject({ kind: 'friend_record', unread: true });
  });

  it('T-NOTIF-05: 別のグループの人の行動は出ない。自分がグループに入る前の仲間の記録も出ない', async () => {
    const a = await makeGroup('D');
    const b = await makeGroup('E');
    const aMate = await a.join('Aの仲間');
    await createRecord(aMate);
    await createRecord(b.owner);
    // 別グループの人が、自分の記録にスタンプを付けようとしても 404（見えない）なので、通知は元から出ない。記録の通知だけ確認する
    expect((await list(b.owner)).items).toEqual([]);

    // 入る前に仲間が記録していた分は、あとから加わった人の通知に出ない
    const late = await a.join('あとから');
    await tick();
    const lateBody = await list(late);
    expect(lateBody.items.map((i) => i.kind)).not.toContain('friend_record');
  });
});
