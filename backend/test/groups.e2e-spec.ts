import { createHash } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createApp, migrateDb, TEST_ORIGIN, withPool } from './helpers/app.js';

// グループと招待の「作る側」の結合テスト（本物の PostgreSQL・本物の better-auth）。DATABASE_URL が無ければ「落ちる」（飛ばさない）。
const url = process.env.DATABASE_URL;

const cookieOf = (res: request.Response): string =>
  (res.headers['set-cookie'] as unknown as string[]).map((c) => c.split(';')[0]).join('; ');

describe('グループと招待を作る（結合: 本物の PostgreSQL・better-auth）', () => {
  let app: INestApplication;

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

  let userSeq = 0;

  // 登録して、その人の Cookie を返す（メールアドレスは ASCII の連番。日本語の名前は表示名にだけ使う）
  const signUpAs = async (name: string): Promise<string> => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/sign-up/email')
      .set('Origin', TEST_ORIGIN)
      .send({ email: `user${++userSeq}@example.com`, password: 'correct-horse-battery', name })
      .expect(200);
    return cookieOf(res);
  };

  const createGroup = (cookie: string, name = '朝ランの会') =>
    request(app.getHttpServer()).post('/api/groups').set('Cookie', cookie).send({ name });

  const createInvitation = (cookie: string) => request(app.getHttpServer()).post('/api/groups/current/invitations').set('Cookie', cookie);

  const revoke = (cookie: string, id: string) => request(app.getHttpServer()).delete(`/api/groups/current/invitations/${id}`).set('Cookie', cookie);

  describe('POST /groups・GET /groups/current', () => {
    // T-AUTH-01 の延長: 4つの道はどれもログイン必須
    it('Cookie なしでは、どの道も 401', async () => {
      const http = request(app.getHttpServer());
      await http.post('/api/groups').send({ name: 'x' }).expect(401);
      await http.get('/api/groups/current').expect(401);
      await http.post('/api/groups/current/invitations').expect(401);
      await http.delete('/api/groups/current/invitations/00000000-0000-4000-8000-000000000000').expect(401);
    });

    // T-GRP-01: 作った人が最初のメンバーになる
    it('グループを作ると 201 で、作った人が最初のメンバーになる', async () => {
      const cookie = await signUpAs('たろう');
      const res = await createGroup(cookie).expect(201);
      expect(res.body).toEqual({ id: expect.any(String), name: '朝ランの会' });

      const current = await request(app.getHttpServer()).get('/api/groups/current').set('Cookie', cookie).expect(200);
      expect(current.body).toMatchObject({ id: res.body.id, name: '朝ランの会' });
      expect(current.body.members).toHaveLength(1);
      expect(current.body.members[0]).toMatchObject({
        name: 'たろう',
        avatar: { body: 'A', hair: 1, hairColor: 'brown', shirtColor: 'teal', pantsColor: 'navy' },
      });
      // メールアドレスは仲間に見せない
      expect(JSON.stringify(current.body)).not.toContain('example.com');
    });

    // T-GRP-06: すでにグループにいる人がグループを作る
    it('すでにグループにいる人がもう1つ作ると 409 ALREADY_IN_GROUP', async () => {
      const cookie = await signUpAs('たろう');
      await createGroup(cookie).expect(201);
      const res = await createGroup(cookie, '二つ目').expect(409);
      expect(res.body).toMatchObject({ code: 'ALREADY_IN_GROUP' });
      const count = await withPool(url!, (pool) => pool.query('select count(*)::int as n from groups'));
      expect(count.rows[0].n).toBe(1);
    });

    // 境界値: グループ名は 1〜20字（design.md / database-design.md）
    it.each([
      ['0字', '', 400],
      ['空白だけ', '   ', 400],
      ['1字', 'あ', 201],
      ['20字', 'あ'.repeat(20), 201],
      ['21字', 'あ'.repeat(21), 400],
    ])('グループ名が%s のときの応答', async (_label, name, status) => {
      const cookie = await signUpAs('たろう');
      await createGroup(cookie, name).expect(status);
    });

    it('グループ名が文字列でないと 400（500 にしない）', async () => {
      const cookie = await signUpAs('たろう');
      await request(app.getHttpServer()).post('/api/groups').set('Cookie', cookie).send({ name: 123 }).expect(400);
      await request(app.getHttpServer()).post('/api/groups').set('Cookie', cookie).send({}).expect(400);
    });

    it('グループに入っていない人の GET /groups/current は 404', async () => {
      const cookie = await signUpAs('たろう');
      await request(app.getHttpServer()).get('/api/groups/current').set('Cookie', cookie).expect(404);
    });
  });

  describe('POST /groups/current/invitations', () => {
    it('グループに入っていない人は 404', async () => {
      const cookie = await signUpAs('たろう');
      await createInvitation(cookie).expect(404);
    });

    // T-INV-05・06・07: 値はこの応答の1回だけ。DB には SHA-256 だけ。強い乱数
    it('招待リンクの値を1回だけ返し、DB にはハッシュだけを保存する', async () => {
      const cookie = await signUpAs('たろう');
      await createGroup(cookie).expect(201);
      const before = Date.now();
      const res = await createInvitation(cookie).expect(201);
      const { id, token, expiresAt } = res.body as { id: string; token: string; expiresAt: string };

      expect(id).toEqual(expect.any(String));
      // 16バイト（128 ビット）以上の乱数 → base64url で 22 字以上
      expect(token).toMatch(/^[A-Za-z0-9_-]{22,}$/);
      // 有効期限は作ってから7日
      const days = (new Date(expiresAt).getTime() - before) / 86_400_000;
      expect(days).toBeGreaterThan(6.99);
      expect(days).toBeLessThan(7.01);

      const rows = (await withPool(url!, (pool) => pool.query('select id, token_hash, revoked_at from invitations'))).rows;
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe(id);
      expect(rows[0].token_hash).toBe(createHash('sha256').update(token).digest('hex'));
      expect(rows[0].token_hash).not.toBe(token);
      expect(rows[0].revoked_at).toBeNull();

      // T-INV-06: グループの取得に値は出ない
      const current = await request(app.getHttpServer()).get('/api/groups/current').set('Cookie', cookie).expect(200);
      expect(JSON.stringify(current.body)).not.toContain(token);
    });

    it('2回作ると別の値になる', async () => {
      const cookie = await signUpAs('たろう');
      await createGroup(cookie).expect(201);
      const a = (await createInvitation(cookie).expect(201)).body;
      const b = (await createInvitation(cookie).expect(201)).body;
      expect(a.token).not.toBe(b.token);
      expect(a.id).not.toBe(b.id);
    });
  });

  describe('DELETE /groups/current/invitations/{id}（T-INV-14・15）', () => {
    it('取り消すと 204 で、revoked_at に時刻が入り、行は残る', async () => {
      const cookie = await signUpAs('たろう');
      await createGroup(cookie).expect(201);
      const { id } = (await createInvitation(cookie).expect(201)).body;

      await revoke(cookie, id).expect(204);
      const rows = (await withPool(url!, (pool) => pool.query('select revoked_at from invitations'))).rows;
      expect(rows).toHaveLength(1);
      expect(rows[0].revoked_at).not.toBeNull();
    });

    it('2回取り消しても 204（冪等）で、最初の時刻のまま', async () => {
      const cookie = await signUpAs('たろう');
      await createGroup(cookie).expect(201);
      const { id } = (await createInvitation(cookie).expect(201)).body;

      await revoke(cookie, id).expect(204);
      const first = (await withPool(url!, (pool) => pool.query('select revoked_at from invitations'))).rows[0].revoked_at;
      await revoke(cookie, id).expect(204);
      const second = (await withPool(url!, (pool) => pool.query('select revoked_at from invitations'))).rows[0].revoked_at;
      expect(second).toEqual(first);
    });

    // T-INV-15: 他のグループの招待は取り消せない（存在を教えない 404）
    it('他のグループの招待は 404 で、取り消されない', async () => {
      const taro = await signUpAs('たろう');
      const hanako = await signUpAs('はなこ');
      await createGroup(taro, 'たろうの会').expect(201);
      await createGroup(hanako, 'はなこの会').expect(201);
      const { id } = (await createInvitation(taro).expect(201)).body;

      await revoke(hanako, id).expect(404);
      const rows = (await withPool(url!, (pool) => pool.query('select revoked_at from invitations'))).rows;
      expect(rows[0].revoked_at).toBeNull();
    });

    it('存在しない ID・UUID でない ID は 404（500 にしない）', async () => {
      const cookie = await signUpAs('たろう');
      await createGroup(cookie).expect(201);
      await revoke(cookie, '00000000-0000-4000-8000-000000000000').expect(404);
      await revoke(cookie, 'not-a-uuid').expect(404);
    });

    it('グループに入っていない人は 404', async () => {
      const cookie = await signUpAs('たろう');
      await revoke(cookie, '00000000-0000-4000-8000-000000000000').expect(404);
    });
  });
});
