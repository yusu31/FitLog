import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createApp, migrateDb, resetDb, TEST_ORIGIN } from './helpers/app.js';

// 地図ゴースト（F-17: GET /records/{id} の previousRun）の結合テスト。docs/testing-design.md 3-18（T-MGHOST）。
// 自分のルート付きランの詳細にだけ、自分の「ひとつ前のルート付きラン」を添える。他人のルートは読ませない。
const url = process.env.DATABASE_URL;

const cookieOf = (res: request.Response): string =>
  (res.headers['set-cookie'] as unknown as string[]).map((c) => c.split(';')[0]).join('; ');

const DAY1 = '2026-10-20T03:00:00.000Z';
const DAY2 = '2026-10-23T03:00:00.000Z';
const DAY3 = '2026-10-27T03:00:00.000Z';

const routeOf = (offset: number) => ({
  type: 'LineString' as const,
  coordinates: [
    [139.7 + offset, 35.68],
    [139.71 + offset, 35.69],
    [139.72 + offset, 35.7],
  ],
});

describe('地図ゴースト（結合: 本物の PostgreSQL・better-auth）', () => {
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
      .send({ email: `mg${++userSeq}@example.com`, password: 'correct-horse-battery', name })
      .expect(200);
    return cookieOf(res);
  };

  // ランを作る。route を null にすると手入力のラン（ルートなし）
  const run = async (cookie: string, recordedAt: string, route: ReturnType<typeof routeOf> | null, distanceM = 5000): Promise<string> => {
    const id = randomUUID();
    await http()
      .post('/api/records')
      .set('Cookie', cookie)
      .send({ id, kind: 'run', recordedAt, run: { distanceM, durationS: 1800, ...(route ? { route } : {}) } })
      .expect(201);
    return id;
  };

  const detail = async (cookie: string, id: string) => (await http().get(`/api/records/${id}`).set('Cookie', cookie).expect(200)).body as Record<string, unknown>;

  it('ひとつ前のルート付きランが previousRun に入る（記録の id・日時・距離・時間・ルート）（T-MGHOST-01）', async () => {
    const me = await signUpAs('たろう');
    const before = await run(me, DAY1, routeOf(0), 4200);
    const now = await run(me, DAY2, routeOf(0.01));
    const body = await detail(me, now);
    expect(body.previousRun).toEqual({ recordId: before, recordedAt: DAY1, distanceM: 4200, durationS: 1800, route: routeOf(0) });
  });

  it('いちばん近い前回を選ぶ（さらに古いルートではない）（T-MGHOST-02）', async () => {
    const me = await signUpAs('たろう');
    await run(me, DAY1, routeOf(0));
    const near = await run(me, DAY2, routeOf(0.02));
    const now = await run(me, DAY3, routeOf(0.01));
    expect((await detail(me, now)).previousRun).toMatchObject({ recordId: near });
  });

  it('ルートのない手入力のランは飛ばして、その前のルート付きを選ぶ（T-MGHOST-03）', async () => {
    const me = await signUpAs('たろう');
    const withRoute = await run(me, DAY1, routeOf(0));
    await run(me, DAY2, null);
    const now = await run(me, DAY3, routeOf(0.01));
    expect((await detail(me, now)).previousRun).toMatchObject({ recordId: withRoute });
  });

  it('前回がない（最初のラン）なら previousRun は付かない（T-MGHOST-04）', async () => {
    const me = await signUpAs('たろう');
    const now = await run(me, DAY1, routeOf(0));
    expect(await detail(me, now)).not.toHaveProperty('previousRun');
  });

  it('今回より新しいランは前回ではない（古いほうの詳細には付かない）（T-MGHOST-05）', async () => {
    const me = await signUpAs('たろう');
    const old = await run(me, DAY1, routeOf(0));
    await run(me, DAY2, routeOf(0.01));
    expect(await detail(me, old)).not.toHaveProperty('previousRun');
  });

  it('今回にルートがない（手入力）なら previousRun は付かない（T-MGHOST-06）', async () => {
    const me = await signUpAs('たろう');
    await run(me, DAY1, routeOf(0));
    const now = await run(me, DAY2, null);
    expect(await detail(me, now)).not.toHaveProperty('previousRun');
  });

  it('他人のランは前回に混ざらない（T-MGHOST-07）', async () => {
    const me = await signUpAs('たろう');
    const other = await signUpAs('はなこ');
    await run(other, DAY1, routeOf(0.5));
    const now = await run(me, DAY2, routeOf(0.01));
    expect(await detail(me, now)).not.toHaveProperty('previousRun');
  });

  it('筋トレ・休みの詳細には付かない（T-MGHOST-08）', async () => {
    const me = await signUpAs('たろう');
    await run(me, DAY1, routeOf(0));
    const id = randomUUID();
    await http().post('/api/records').set('Cookie', me).send({ id, kind: 'workout', recordedAt: DAY2 }).expect(201);
    expect(await detail(me, id)).not.toHaveProperty('previousRun');
  });

  it('同じグループの仲間が自分のランの詳細を開いても、仲間の前回ルートは付かない（T-MGHOST-09）', async () => {
    const owner = await signUpAs('たろう');
    const created = (await http().post('/api/groups').set('Cookie', owner).send({ name: 'グループ' }).expect(201)).body as unknown;
    void created;
    const { token } = (await http().post('/api/groups/current/invitations').set('Cookie', owner).expect(201)).body as { token: string };
    const mate = await signUpAs('はなこ');
    await http().post(`/api/invitations/${token}/accept`).set('Cookie', mate).expect(200);

    await run(owner, DAY1, routeOf(0));
    const ownerNow = await run(owner, DAY2, routeOf(0.01));
    // 仲間から見たたろうさんのラン: 詳細は見えるが、たろうさんの前回ルートは付けない
    const seenByMate = await detail(mate, ownerNow);
    expect(seenByMate).not.toHaveProperty('previousRun');
    // 本人から見ると付く（権限の判定を外すと上の行が赤になる）
    expect(await detail(owner, ownerNow)).toHaveProperty('previousRun');
  });
});
