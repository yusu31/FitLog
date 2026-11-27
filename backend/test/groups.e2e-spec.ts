import { createHash, randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createApp, migrateDb, resetDb, TEST_ORIGIN, withPool } from './helpers/app.js';

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
    await resetDb(url!);
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

  // 02-9 PR 6: ミッション（名前・説明・背景）と、メンバーの今日のようす
  describe('PATCH /groups/current（ミッションを直す）', () => {
    const patch = (cookie: string, body: object) => request(app.getHttpServer()).patch('/api/groups/current').set('Cookie', cookie).send(body);
    const join = async (owner: string, name: string): Promise<string> => {
      const inv = await createInvitation(owner).expect(201);
      const cookie = await signUpAs(name);
      await request(app.getHttpServer()).post(`/api/invitations/${inv.body.token}/accept`).set('Cookie', cookie).expect(200);
      return cookie;
    };

    it('ログインしていないと 401', async () => {
      await request(app.getHttpServer()).patch('/api/groups/current').send({ name: 'x' }).expect(401);
    });

    it('初めは説明なし・背景は運動場（yard）', async () => {
      const cookie = await signUpAs('たろう');
      await createGroup(cookie).expect(201);
      const current = await request(app.getHttpServer()).get('/api/groups/current').set('Cookie', cookie).expect(200);
      expect(current.body).toMatchObject({ description: null, background: 'yard' });
    });

    it('名前・説明・背景を直せて、送らなかった項目は変わらない', async () => {
      const cookie = await signUpAs('たろう');
      await createGroup(cookie).expect(201);
      const res = await patch(cookie, { description: '朝6時に走る', background: 'park' }).expect(200);
      expect(res.body).toMatchObject({ name: '朝ランの会', description: '朝6時に走る', background: 'park' });
      const res2 = await patch(cookie, { name: '夜ラン部' }).expect(200);
      expect(res2.body).toMatchObject({ name: '夜ラン部', description: '朝6時に走る', background: 'park' });
    });

    it('出来事: 仲間が加わると「加わった」、ミッションを直すと「ミッション」が events に出る（作った人の参加は出ない）', async () => {
      const owner = await signUpAs('たろう');
      await createGroup(owner).expect(201);
      const first = await request(app.getHttpServer()).get('/api/groups/current').set('Cookie', owner).expect(200);
      expect(first.body.events).toEqual([]);

      const friend = await join(owner, 'はなこ');
      const joined = await request(app.getHttpServer()).get('/api/groups/current').set('Cookie', owner).expect(200);
      expect(joined.body.events.map((e: { kind: string; actorName: string }) => [e.kind, e.actorName])).toEqual([['joined', 'はなこ']]);

      const res = await patch(friend, { background: 'gym' }).expect(200);
      expect(res.body.events.map((e: { kind: string; actorName: string }) => [e.kind, e.actorName])).toEqual([['mission', 'はなこ'], ['joined', 'はなこ']]);
    });

    it('説明は空文字か null で消せる', async () => {
      const cookie = await signUpAs('たろう');
      await createGroup(cookie).expect(201);
      await patch(cookie, { description: 'あ' }).expect(200);
      expect((await patch(cookie, { description: '  ' }).expect(200)).body.description).toBeNull();
      await patch(cookie, { description: 'い' }).expect(200);
      expect((await patch(cookie, { description: null }).expect(200)).body.description).toBeNull();
    });

    it('メンバーなら誰でも直せる（作った人でなくてもよい）', async () => {
      const owner = await signUpAs('たろう');
      await createGroup(owner).expect(201);
      const other = await join(owner, 'はなこ');
      const res = await patch(other, { background: 'city' }).expect(200);
      expect(res.body.background).toBe('city');
    });

    it('100字ちょうどは通り、101字は 400。名前は21字で 400。背景は4種以外が 400。何も送らないと 400', async () => {
      const cookie = await signUpAs('たろう');
      await createGroup(cookie).expect(201);
      await patch(cookie, { description: 'あ'.repeat(100) }).expect(200);
      await patch(cookie, { description: 'あ'.repeat(101) }).expect(400);
      await patch(cookie, { name: 'あ'.repeat(21) }).expect(400);
      await patch(cookie, { background: 'space' }).expect(400);
      await patch(cookie, { description: 123 }).expect(400);
      await patch(cookie, {}).expect(400);
    });

    it('グループに入っていない人は 404', async () => {
      const cookie = await signUpAs('たろう');
      await patch(cookie, { name: 'x' }).expect(404);
    });
  });

  describe('GET /groups/current の members[].today（今日のようす）', () => {
    const record = (cookie: string, kind: 'workout' | 'run' | 'rest' | 'post') =>
      request(app.getHttpServer())
        .post('/api/records')
        .set('Cookie', cookie)
        .send({ id: randomUUID(), kind, recordedAt: new Date().toISOString(), ...(kind === 'run' ? { run: { distanceM: 5000, durationS: 1800 } } : {}) });

    it('記録の種類から workout・run・rest・none になり、投稿だけの日は none', async () => {
      const a = await signUpAs('あ');
      await createGroup(a).expect(201);
      const join = async (name: string): Promise<string> => {
        const inv = await createInvitation(a).expect(201);
        const c = await signUpAs(name);
        await request(app.getHttpServer()).post(`/api/invitations/${inv.body.token}/accept`).set('Cookie', c).expect(200);
        return c;
      };
      const b = await join('い');
      const c = await join('う');
      const d = await join('え');
      await record(a, 'workout').expect(201);
      await record(b, 'run').expect(201);
      await record(c, 'rest').expect(201);
      await record(d, 'post').expect(201);
      const res = await request(app.getHttpServer()).get('/api/groups/current').set('Cookie', a).expect(200);
      const todayOf = (name: string) => res.body.members.find((m: { name: string }) => m.name === name).today;
      expect([todayOf('あ'), todayOf('い'), todayOf('う'), todayOf('え')]).toEqual(['workout', 'run', 'rest', 'none']);
    });

    it('筋トレとランの両方がある日は workout。記録が無ければ none', async () => {
      const a = await signUpAs('あ');
      await createGroup(a).expect(201);
      const before = await request(app.getHttpServer()).get('/api/groups/current').set('Cookie', a).expect(200);
      expect(before.body.members[0].today).toBe('none');
      await record(a, 'run').expect(201);
      await record(a, 'workout').expect(201);
      const after = await request(app.getHttpServer()).get('/api/groups/current').set('Cookie', a).expect(200);
      expect(after.body.members[0].today).toBe('workout');
    });
  });
});
