import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createApp, migrateDb, TEST_ORIGIN, withPool } from './helpers/app.js';

// 招待を受ける側（閲覧・参加）とグループを出るの結合テスト（本物の PostgreSQL・本物の better-auth）。
// DATABASE_URL が無ければ「落ちる」（飛ばさない）。
const url = process.env.DATABASE_URL;

const cookieOf = (res: request.Response): string =>
  (res.headers['set-cookie'] as unknown as string[]).map((c) => c.split(';')[0]).join('; ');

describe('招待を受ける・参加する・出る（結合: 本物の PostgreSQL・better-auth）', () => {
  let app: INestApplication;
  let userSeq = 0;

  beforeAll(async () => {
    if (!url) throw new Error('DATABASE_URL が設定されていません');
    await migrateDb(process.env.MIGRATION_DATABASE_URL ?? url);
  });

  beforeEach(async () => {
    await withPool(url!, (pool) => pool.query('TRUNCATE users CASCADE'));
    app = await createApp(url);
  });

  afterEach(async () => {
    await app?.close();
  });

  const http = (target = app) => request(target.getHttpServer());

  // 登録して Cookie を返す（メールは ASCII の連番。日本語の名前は表示名だけ）
  const signUpAs = async (name: string, target = app): Promise<string> => {
    const res = await http(target)
      .post('/api/auth/sign-up/email')
      .set('Origin', TEST_ORIGIN)
      .send({ email: `inv${++userSeq}@example.com`, password: 'correct-horse-battery', name })
      .expect(200);
    return cookieOf(res);
  };

  // 作った人＋ (members - 1) 人のグループと、有効な招待リンクの値を用意する
  const groupWith = async (members: number) => {
    const owner = await signUpAs('おや');
    await http().post('/api/groups').set('Cookie', owner).send({ name: '朝トレ部' }).expect(201);
    const { token, id } = (await http().post('/api/groups/current/invitations').set('Cookie', owner).expect(201)).body as {
      token: string;
      id: string;
    };
    for (let i = 1; i < members; i++) {
      const member = await signUpAs(`なかま${i}`);
      await http().post(`/api/invitations/${token}/accept`).set('Cookie', member).expect(200);
    }
    return { owner, token, invitationId: id };
  };

  const countMembers = async () =>
    (await withPool(url!, (pool) => pool.query('select count(*)::int as n from group_members'))).rows[0].n as number;

  describe('GET /invitations/{token}（ログイン不要）', () => {
    // T-INV-10: 未ログインでも見える。返すのはグループ名と人数だけ
    it('ログインせずに呼ぶと 200 で、グループ名と人数だけを返す', async () => {
      const { token } = await groupWith(2);
      const res = await http().get(`/api/invitations/${token}`).expect(200);
      expect(res.body).toEqual({ groupName: '朝トレ部', memberCount: 2, memberMax: 5 });
    });

    // T-INV-04: 存在しない値・形の違う値
    it.each([
      ['存在しない値', 'A'.repeat(32)],
      ['形の違う値', 'not a token!'],
    ])('%s は 404', async (_label, token) => {
      await http().get(`/api/invitations/${encodeURIComponent(token)}`).expect(404);
    });

    // T-INV-11・12・14: 期限切れは 410、取り消し済みは 404（GET と参加の両方）
    it('期限切れは GET も参加も 410', async () => {
      const { token } = await groupWith(1);
      await withPool(url!, (pool) => pool.query("update invitations set expires_at = now() - interval '1 second'"));
      const res = await http().get(`/api/invitations/${token}`).expect(410);
      expect(res.body).toMatchObject({ code: 'INVITATION_EXPIRED' });
      const guest = await signUpAs('おきゃく');
      await http().post(`/api/invitations/${token}/accept`).set('Cookie', guest).expect(410);
    });

    it('取り消し済みは GET も参加も 404', async () => {
      const { owner, token, invitationId } = await groupWith(1);
      await http().delete(`/api/groups/current/invitations/${invitationId}`).set('Cookie', owner).expect(204);
      await http().get(`/api/invitations/${token}`).expect(404);
      const guest = await signUpAs('おきゃく');
      await http().post(`/api/invitations/${token}/accept`).set('Cookie', guest).expect(404);
    });
  });

  describe('POST /invitations/{token}/accept', () => {
    it('ログインしていなければ 401', async () => {
      const { token } = await groupWith(1);
      await http().post(`/api/invitations/${token}/accept`).expect(401);
    });

    it('参加すると 200 でグループを返し、仲間の一覧に入る', async () => {
      const { owner, token } = await groupWith(1);
      const guest = await signUpAs('はなこ');
      const res = await http().post(`/api/invitations/${token}/accept`).set('Cookie', guest).expect(200);
      expect(res.body).toEqual({ id: expect.any(String), name: '朝トレ部' });
      const current = await http().get('/api/groups/current').set('Cookie', owner).expect(200);
      expect(current.body.members.map((m: { name: string }) => m.name)).toEqual(['おや', 'はなこ']);
    });

    // T-GRP-02・03: 4人なら5人目が入れる。5人なら6人目は 409
    it('4人のグループに5人目は入れ、6人目は 409 GROUP_FULL', async () => {
      const { token } = await groupWith(4);
      const fifth = await signUpAs('ごにんめ');
      await http().post(`/api/invitations/${token}/accept`).set('Cookie', fifth).expect(200);
      const sixth = await signUpAs('ろくにんめ');
      const res = await http().post(`/api/invitations/${token}/accept`).set('Cookie', sixth).expect(409);
      expect(res.body).toMatchObject({ code: 'GROUP_FULL' });
      expect(await countMembers()).toBe(5);
    });

    // T-GRP-05: すでに別のグループにいる人。同じグループにもう一度でも同じ
    it('すでにグループにいる人は 409 ALREADY_IN_GROUP（別のグループでも、同じグループでも）', async () => {
      const { token } = await groupWith(1);
      const other = await signUpAs('よそのひと');
      await http().post('/api/groups').set('Cookie', other).send({ name: 'よそ' }).expect(201);
      const res = await http().post(`/api/invitations/${token}/accept`).set('Cookie', other).expect(409);
      expect(res.body).toMatchObject({ code: 'ALREADY_IN_GROUP' });

      const guest = await signUpAs('はなこ');
      await http().post(`/api/invitations/${token}/accept`).set('Cookie', guest).expect(200);
      await http().post(`/api/invitations/${token}/accept`).set('Cookie', guest).expect(409);
    });

    // T-GRP-04: 4人のグループに同時に2人。1人だけ成功し、5人を超えない。
    // 本番の DB 接続は1環境1本なので、1つのアプリでは要求が順番待ちになって同時に起きない。
    // 本番で同時に起きるのは Lambda が2台並ぶとき → アプリを2つ起動して、それぞれから1人ずつ送る。
    // 2つ目は DB に直接つなぐ: 手元の PgBouncer は DB への接続が1本（DEFAULT_POOL_SIZE=1）なので、
    // 両方を通すと DB の手前で順番待ちになり、ロックが無くても通ってしまう（本番の Neon の窓口は接続を複数持つ）。
    // タイミングで偶然通らないよう、3回くり返す
    it('同時に2人が参加しても、1人だけが成功し5人を超えない（3回）', async () => {
      const direct = process.env.MIGRATION_DATABASE_URL;
      if (!direct) throw new Error('MIGRATION_DATABASE_URL（DB への直接の接続）が設定されていません');
      const second = await createApp(direct);
      try {
        for (let round = 0; round < 3; round++) {
          await withPool(url!, (pool) => pool.query('TRUNCATE users CASCADE'));
          const { token } = await groupWith(4);
          const x = await signUpAs('えっくす');
          const y = await signUpAs('わい', second);
          const results = await Promise.all([
            http().post(`/api/invitations/${token}/accept`).set('Cookie', x),
            http(second).post(`/api/invitations/${token}/accept`).set('Cookie', y),
          ]);
          expect(results.map((r) => r.status).sort((a, b) => a - b)).toEqual([200, 409]);
          expect(results.find((r) => r.status === 409)?.body).toMatchObject({ code: 'GROUP_FULL' });
          expect(await countMembers()).toBe(5);
        }
      } finally {
        await second.close();
      }
    });
  });

  describe('DELETE /groups/current/members/me', () => {
    // T-GRP-07: 最後の1人が出ても、グループの行は残る
    it('最後の1人が出ると 204 で、グループは空のまま残る。もう一度は 404', async () => {
      const { owner } = await groupWith(1);
      await http().delete('/api/groups/current/members/me').set('Cookie', owner).expect(204);
      await http().get('/api/groups/current').set('Cookie', owner).expect(404);
      const groups = (await withPool(url!, (pool) => pool.query('select count(*)::int as n from groups'))).rows[0].n;
      expect(groups).toBe(1);
      expect(await countMembers()).toBe(0);
      await http().delete('/api/groups/current/members/me').set('Cookie', owner).expect(404);
    });

    // T-GRP-08: 出た人は、別のグループに入れる（1人1グループの UNIQUE に当たらない）
    it('出た人は、別のグループの招待で参加できる', async () => {
      const { token } = await groupWith(1);
      const mover = await signUpAs('ひっこし');
      await http().post('/api/groups').set('Cookie', mover).send({ name: '前のグループ' }).expect(201);
      await http().delete('/api/groups/current/members/me').set('Cookie', mover).expect(204);
      await http().post(`/api/invitations/${token}/accept`).set('Cookie', mover).expect(200);
    });
  });
});
