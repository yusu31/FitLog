import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createApp, migrateDb, resetDb, TEST_ORIGIN } from './helpers/app.js';

// 仲間のゴースト（F-16: GET /exercises/{id}/previous?friendId=）とメニューのコピー（F-24: POST /records の copiedFromUserId）の結合テスト。
// どちらも「他人のデータを読む」経路なので、権限（同じグループ以外は 404）を厚く確かめる。docs/testing-design.md 3-16（T-FGHOST・T-COPY）
const url = process.env.DATABASE_URL;

const cookieOf = (res: request.Response): string =>
  (res.headers['set-cookie'] as unknown as string[]).map((c) => c.split(';')[0]).join('; ');

const BENCH_PRESS_ID = '00000000-0000-4000-8000-000000000001';
const SQUAT_ID = '00000000-0000-4000-8000-000000000024';
const DAY1 = '2026-10-20T03:00:00.000Z';
const DAY2 = '2026-10-27T03:00:00.000Z';

describe('仲間のゴーストとメニューのコピー（結合: 本物の PostgreSQL・better-auth）', () => {
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
  const signUpAs = async (name: string): Promise<{ cookie: string; id: string }> => {
    const res = await http()
      .post('/api/auth/sign-up/email')
      .set('Origin', TEST_ORIGIN)
      .send({ email: `fgc${++userSeq}@example.com`, password: 'correct-horse-battery', name })
      .expect(200);
    return { cookie: cookieOf(res), id: (res.body as { user: { id: string } }).user.id };
  };

  type Member = { cookie: string; id: string };
  // 作った人＋ (members - 1) 人のグループ
  const groupWith = async (members: number, label: string): Promise<Member[]> => {
    const all = [await signUpAs(`${label}1`)];
    await http().post('/api/groups').set('Cookie', all[0].cookie).send({ name: `グループ${label}` }).expect(201);
    const { token } = (await http().post('/api/groups/current/invitations').set('Cookie', all[0].cookie).expect(201)).body as { token: string };
    for (let i = 1; i < members; i++) {
      const m = await signUpAs(`${label}${i + 1}`);
      await http().post(`/api/invitations/${token}/accept`).set('Cookie', m.cookie).expect(200);
      all.push(m);
    }
    return all;
  };

  // 筋トレの記録を作り、セットを入れる
  const workout = async (cookie: string, recordedAt: string, exerciseId: string, sets: Array<[number, number]>): Promise<string> => {
    const id = randomUUID();
    await http().post('/api/records').set('Cookie', cookie).send({ id, kind: 'workout', recordedAt }).expect(201);
    for (const [i, [weightKg, reps]] of sets.entries()) {
      await http().post(`/api/records/${id}/sets`).set('Cookie', cookie).send({ id: randomUUID(), exerciseId, setNo: i + 1, weightKg, reps }).expect(201);
    }
    return id;
  };

  const previousOf = (cookie: string, exerciseId: string, friendId?: string) =>
    http().get(`/api/exercises/${exerciseId}/previous${friendId === undefined ? '' : `?friendId=${encodeURIComponent(friendId)}`}`).set('Cookie', cookie);

  const addCustom = async (cookie: string, name: string): Promise<string> =>
    ((await http().post('/api/exercises').set('Cookie', cookie).send({ name, bodyPart: 'chest' }).expect(201)).body as { id: string }).id;

  describe('GET /exercises/{id}/previous?friendId=（仲間のゴースト）', () => {
    it('同じグループの仲間の前回が返り、自己ベストは null（T-FGHOST-01）', async () => {
      const [me, mate] = await groupWith(2, 'A');
      await workout(mate.cookie, DAY1, BENCH_PRESS_ID, [[40, 10], [45, 8]]);
      await workout(me.cookie, DAY1, BENCH_PRESS_ID, [[30, 10]]);

      const res = await previousOf(me.cookie, BENCH_PRESS_ID, mate.id).expect(200);
      const body = res.body as { previous: { sets: Array<{ weightKg: number; reps: number }> } | null; personalBest: unknown };
      expect(body.previous?.sets.map((s) => [s.weightKg, s.reps])).toEqual([[40, 10], [45, 8]]);
      expect(body.personalBest).toBeNull();
    });

    it('仲間の直近の記録を返す（古い記録ではない）（T-FGHOST-02）', async () => {
      const [me, mate] = await groupWith(2, 'A');
      await workout(mate.cookie, DAY1, BENCH_PRESS_ID, [[40, 10]]);
      await workout(mate.cookie, DAY2, BENCH_PRESS_ID, [[50, 5]]);
      const body = (await previousOf(me.cookie, BENCH_PRESS_ID, mate.id).expect(200)).body as { previous: { sets: Array<{ weightKg: number }> } };
      expect(body.previous.sets[0].weightKg).toBe(50);
    });

    it('仲間がその種目を記録していなければ previous が null（T-FGHOST-03）', async () => {
      const [me, mate] = await groupWith(2, 'A');
      await workout(mate.cookie, DAY1, SQUAT_ID, [[60, 5]]);
      const body = (await previousOf(me.cookie, BENCH_PRESS_ID, mate.id).expect(200)).body as { previous: unknown };
      expect(body.previous).toBeNull();
    });

    it('別のグループの人は 404（FRIEND_NOT_FOUND）。仲間の記録は読めない（T-FGHOST-04）', async () => {
      const [me] = await groupWith(1, 'A');
      const [other] = await groupWith(1, 'B');
      await workout(other.cookie, DAY1, BENCH_PRESS_ID, [[40, 10]]);
      const res = await previousOf(me.cookie, BENCH_PRESS_ID, other.id).expect(404);
      expect((res.body as { code: string }).code).toBe('FRIEND_NOT_FOUND');
    });

    it('グループに入っていない人から見ると、誰を指定しても 404（T-FGHOST-05）', async () => {
      const [mate] = await groupWith(1, 'A');
      const loner = await signUpAs('なし');
      await workout(mate.cookie, DAY1, BENCH_PRESS_ID, [[40, 10]]);
      await previousOf(loner.cookie, BENCH_PRESS_ID, mate.id).expect(404);
    });

    it('自分自身・存在しない id・UUID でない値・空文字は、どれも同じ 404（T-FGHOST-06）', async () => {
      const [me] = await groupWith(1, 'A');
      for (const friendId of [me.id, 'no-such-user', randomUUID(), '']) {
        const res = await previousOf(me.cookie, BENCH_PRESS_ID, friendId).expect(404);
        expect((res.body as { code: string }).code).toBe('FRIEND_NOT_FOUND');
      }
    });

    it('グループを出た仲間は、出たあと 404 になる（T-FGHOST-07）', async () => {
      const [me, mate] = await groupWith(2, 'A');
      await workout(mate.cookie, DAY1, BENCH_PRESS_ID, [[40, 10]]);
      await previousOf(me.cookie, BENCH_PRESS_ID, mate.id).expect(200);
      await http().delete('/api/groups/current/members/me').set('Cookie', mate.cookie).expect(204);
      await previousOf(me.cookie, BENCH_PRESS_ID, mate.id).expect(404);
    });

    it('自作の種目は、仲間の自作の同じ名前（大文字小文字を区別しない）の種目だけ突き合わせる。名前が違えば null（T-FGHOST-08）', async () => {
      const [me, mate] = await groupWith(2, 'A');
      const mine = await addCustom(me.cookie, 'Cable Fly');
      const theirsSame = await addCustom(mate.cookie, 'cable fly');
      const theirsOther = await addCustom(mate.cookie, 'Pec Deck');
      await workout(mate.cookie, DAY1, theirsSame, [[20, 12]]);
      await workout(mate.cookie, DAY2, theirsOther, [[99, 1]]);

      const body = (await previousOf(me.cookie, mine, mate.id).expect(200)).body as { previous: { sets: Array<{ weightKg: number }> } | null };
      expect(body.previous?.sets[0].weightKg).toBe(20);

      const noMatch = await addCustom(me.cookie, 'Chest Press Machine');
      expect(((await previousOf(me.cookie, noMatch, mate.id).expect(200)).body as { previous: unknown }).previous).toBeNull();
    });

    it('friendId を付けない呼び出しは今までどおり自分の前回と自己ベスト（T-FGHOST-09）', async () => {
      const [me, mate] = await groupWith(2, 'A');
      await workout(mate.cookie, DAY1, BENCH_PRESS_ID, [[99, 9]]);
      await workout(me.cookie, DAY1, BENCH_PRESS_ID, [[30, 10]]);
      const body = (await previousOf(me.cookie, BENCH_PRESS_ID).expect(200)).body as { previous: { sets: Array<{ weightKg: number }> }; personalBest: { weightKg: number } };
      expect(body.previous.sets[0].weightKg).toBe(30);
      expect(body.personalBest.weightKg).toBe(30);
    });
  });

  describe('POST /records の copiedFromUserId（メニューのコピー）', () => {
    const post = (cookie: string, body: Record<string, unknown>) => http().post('/api/records').set('Cookie', cookie).send(body);
    const detail = async (cookie: string, id: string) =>
      (await http().get(`/api/records/${id}`).set('Cookie', cookie).expect(200)).body as { copiedFrom?: { name: string | null } };

    it('同じグループの仲間を指定すると、応答・詳細・一覧に「◯◯さんから」が付く（T-COPY-01）', async () => {
      const [me, mate] = await groupWith(2, 'A');
      const id = randomUUID();
      const res = await post(me.cookie, { id, kind: 'workout', recordedAt: DAY1, copiedFromUserId: mate.id }).expect(201);
      expect((res.body as { copiedFrom?: unknown }).copiedFrom).toEqual({ name: 'A2' });
      expect((await detail(me.cookie, id)).copiedFrom).toEqual({ name: 'A2' });
      const list = (await http().get('/api/records').set('Cookie', me.cookie).expect(200)).body as { items: Array<{ id: string; copiedFrom?: unknown }> };
      expect(list.items.find((i) => i.id === id)?.copiedFrom).toEqual({ name: 'A2' });
    });

    it('指定しない記録には copiedFrom が付かない（T-COPY-02）', async () => {
      const [me] = await groupWith(1, 'A');
      const id = randomUUID();
      const res = await post(me.cookie, { id, kind: 'workout', recordedAt: DAY1 }).expect(201);
      expect(res.body).not.toHaveProperty('copiedFrom');
    });

    it('別のグループの人・自分自身・存在しない id は 404 で、記録は作られない（T-COPY-03）', async () => {
      const [me] = await groupWith(1, 'A');
      const [other] = await groupWith(1, 'B');
      for (const copiedFromUserId of [other.id, me.id, 'no-such-user']) {
        const id = randomUUID();
        const res = await post(me.cookie, { id, kind: 'workout', recordedAt: DAY1, copiedFromUserId }).expect(404);
        expect((res.body as { code: string }).code).toBe('FRIEND_NOT_FOUND');
        await http().get(`/api/records/${id}`).set('Cookie', me.cookie).expect(404);
      }
    });

    it('筋トレ以外（ラン・休み）にコピー元を付けると 409（T-COPY-04）', async () => {
      const [me, mate] = await groupWith(2, 'A');
      await post(me.cookie, { id: randomUUID(), kind: 'run', recordedAt: DAY1, run: { distanceM: 5000, durationS: 1800 }, copiedFromUserId: mate.id }).expect(409);
      await post(me.cookie, { id: randomUUID(), kind: 'rest', recordedAt: DAY1, copiedFromUserId: mate.id }).expect(409);
    });

    it('文字列でない値は 400（T-COPY-05）', async () => {
      const [me] = await groupWith(1, 'A');
      await post(me.cookie, { id: randomUUID(), kind: 'workout', recordedAt: DAY1, copiedFromUserId: 123 }).expect(400);
      await post(me.cookie, { id: randomUUID(), kind: 'workout', recordedAt: DAY1, copiedFromUserId: '' }).expect(400);
    });

    it('コピー元が今のグループを抜けると、詳細の name は null になる（画面は「仲間から」）（T-COPY-06）', async () => {
      const [me, mate] = await groupWith(2, 'A');
      const id = randomUUID();
      await post(me.cookie, { id, kind: 'workout', recordedAt: DAY1, copiedFromUserId: mate.id }).expect(201);
      await http().delete('/api/groups/current/members/me').set('Cookie', mate.cookie).expect(204);
      expect((await detail(me.cookie, id)).copiedFrom).toEqual({ name: null });
    });

    it('同じ id の再送は1回目のまま（200）。コピー元が抜けたあとでも成功し、別の値で上書きされない（T-COPY-07）', async () => {
      const [me, mate] = await groupWith(2, 'A');
      const id = randomUUID();
      await post(me.cookie, { id, kind: 'workout', recordedAt: DAY1, copiedFromUserId: mate.id }).expect(201);
      await http().delete('/api/groups/current/members/me').set('Cookie', mate.cookie).expect(204);
      const again = await post(me.cookie, { id, kind: 'workout', recordedAt: DAY1, copiedFromUserId: mate.id }).expect(200);
      expect((again.body as { copiedFrom?: unknown }).copiedFrom).toEqual({ name: null });
    });

    it('仲間が見る詳細の札は、見る人と同じグループかで決まる（T-COPY-08）', async () => {
      const [me, mate, third] = await groupWith(3, 'A');
      const id = randomUUID();
      await post(me.cookie, { id, kind: 'workout', recordedAt: DAY1, copiedFromUserId: mate.id }).expect(201);
      expect((await detail(third.cookie, id)).copiedFrom).toEqual({ name: 'A2' });
      // コピー元の本人が見ると、自分以外の仲間ではないので名前は出さない（「仲間から」）
      expect((await detail(mate.cookie, id)).copiedFrom).toEqual({ name: null });
    });
  });
});
