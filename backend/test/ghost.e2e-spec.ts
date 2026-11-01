import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createApp, migrateDb, resetDb, TEST_ORIGIN } from './helpers/app.js';

// ゴースト（前回との比べ結果）と自己ベストの結合テスト（本物の PostgreSQL・本物の better-auth）。
// docs/testing-design.md 3-2 の T-GHOST-11・12、T-PB-01〜06、T-OFF-02（再送で判定が変わらない）と、GET /exercises/{id}/previous。
// 比べ方そのもの（T-GHOST-01〜10）は共通の関数の単体テスト（src/common/ghost.spec.ts）。ここでは代表を応答で確かめる。
const url = process.env.DATABASE_URL;

const cookieOf = (res: request.Response): string =>
  (res.headers['set-cookie'] as unknown as string[]).map((c) => c.split(';')[0]).join('; ');

const BENCH_PRESS_ID = '00000000-0000-4000-8000-000000000001';
const SQUAT_ID = '00000000-0000-4000-8000-000000000024';
const DAY1 = '2026-10-20T03:00:00.000Z';
const DAY2 = '2026-10-27T03:00:00.000Z';
const DAY3 = '2026-11-01T03:00:00.000Z';

describe('ゴーストと自己ベスト（結合: 本物の PostgreSQL・better-auth）', () => {
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
  const signUpAs = async (name: string): Promise<string> => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/sign-up/email')
      .set('Origin', TEST_ORIGIN)
      .send({ email: `ghost${++userSeq}@example.com`, password: 'correct-horse-battery', name })
      .expect(200);
    return cookieOf(res);
  };

  const createRecord = async (cookie: string, recordedAt: string, kind: 'workout' | 'rest' = 'workout'): Promise<string> => {
    const id = randomUUID();
    await request(app.getHttpServer()).post('/api/records').set('Cookie', cookie).send({ id, kind, recordedAt }).expect(201);
    return id;
  };

  type Sent = { id: string; exerciseId: string; setNo: number; weightKg: number; reps: number };
  const send = (cookie: string, recordId: string, setNo: number, weightKg: number, reps: number, exerciseId = BENCH_PRESS_ID) => {
    const body: Sent = { id: randomUUID(), exerciseId, setNo, weightKg, reps };
    return { body, req: () => request(app.getHttpServer()).post(`/api/records/${recordId}/sets`).set('Cookie', cookie).send(body) };
  };
  // セットを足して応答の本文を返す
  const add = async (cookie: string, recordId: string, setNo: number, weightKg: number, reps: number, exerciseId = BENCH_PRESS_ID) =>
    (await send(cookie, recordId, setNo, weightKg, reps, exerciseId).req().expect(201)).body as { result: string | null; isPersonalBest: boolean };

  describe('ゴースト（result）', () => {
    // 前回が無い（デシジョンテーブルのケース1）
    it('前回が無い種目は result が null', async () => {
      const cookie = await signUpAs('たろう');
      const r = await createRecord(cookie, DAY1);
      expect((await add(cookie, r, 1, 40, 10)).result).toBeNull();
    });

    // T-GHOST-02・04・05・07 の代表を応答で確かめる
    it.each<[string, number, number, 'up' | 'same' | 'down']>([
      ['T-GHOST-02 同じ重量で回数が多い', 40, 11, 'up'],
      ['T-GHOST-03 同じ', 40, 10, 'same'],
      ['T-GHOST-04 同じ重量で回数が少ない', 40, 9, 'down'],
      ['T-GHOST-05 重量が違い volume が大きい（400 → 405）', 45, 9, 'up'],
      ['T-GHOST-07 重量が違い volume が小さい（400 → 360）', 45, 8, 'down'],
    ])('%s', async (_name, weightKg, reps, expected) => {
      const cookie = await signUpAs('たろう');
      await add(cookie, await createRecord(cookie, DAY1), 1, 40, 10);
      const today = await createRecord(cookie, DAY2);
      expect((await add(cookie, today, 1, weightKg, reps)).result).toBe(expected);
    });

    // T-GHOST-11: 前回は同じ種目の直近の記録。別の種目・他の人・休み・自分より後の記録は選ばない
    it('T-GHOST-11 前回に選ぶのは、同じ人・同じ種目・自分より前の直近の記録だけ', async () => {
      const cookie = await signUpAs('たろう');
      const other = await signUpAs('はなこ');
      // 古い記録（40×10）より後に、選んではいけない記録をいろいろ置く
      await add(cookie, await createRecord(cookie, DAY1), 1, 40, 10);
      await add(cookie, await createRecord(cookie, '2026-10-22T03:00:00.000Z'), 1, 100, 100, SQUAT_ID); // 別の種目
      await add(other, await createRecord(other, '2026-10-23T03:00:00.000Z'), 1, 100, 100); // 他の人
      await createRecord(cookie, '2026-10-24T03:00:00.000Z', 'rest'); // 休み
      await add(cookie, await createRecord(cookie, DAY3), 1, 200, 10); // 自分より後の記録

      const today = await createRecord(cookie, DAY2);
      // 前回 = 40×10（DAY1）。45×9=405 は上回り。もし別の記録を選んでいたら up にならない
      expect((await add(cookie, today, 1, 45, 9)).result).toBe('up');
    });

    // T-GHOST-12: 前回のセット数より今回が多いとき、前回の最後のセットと比べる
    it('T-GHOST-12 前回に同じセット番号が無ければ、前回の最後のセットと比べる', async () => {
      const cookie = await signUpAs('たろう');
      const prev = await createRecord(cookie, DAY1);
      await add(cookie, prev, 1, 40, 10);
      await add(cookie, prev, 2, 40, 8); // 最後のセット = 40×8
      const today = await createRecord(cookie, DAY2);
      await add(cookie, today, 1, 40, 10);
      await add(cookie, today, 2, 40, 8);
      expect((await add(cookie, today, 3, 40, 9)).result).toBe('up'); // 3セット目は 40×8 と比べる（1セット目の 40×10 なら down）
    });
  });

  describe('自己ベスト（isPersonalBest）', () => {
    it('T-PB-01 その種目の初めての記録の最初のセットは付かない', async () => {
      const cookie = await signUpAs('たろう');
      expect((await add(cookie, await createRecord(cookie, DAY1), 1, 40, 10)).isPersonalBest).toBe(false);
    });

    // 過去最大 360（45×8）に対し 361・360・359。重量は 0.5 刻みなので 361 = 180.5×2、359 = 179.5×2
    it.each<[string, number, number, boolean]>([
      ['T-PB-02 361 は付く', 180.5, 2, true],
      ['T-PB-03 同じ 360 は付かない', 45, 8, false],
      ['T-PB-04 359 は付かない', 179.5, 2, false],
    ])('%s', async (_name, weightKg, reps, expected) => {
      const cookie = await signUpAs('たろう');
      await add(cookie, await createRecord(cookie, DAY1), 1, 45, 8); // 過去最大 360
      expect((await add(cookie, await createRecord(cookie, DAY2), 1, weightKg, reps)).isPersonalBest).toBe(expected);
    });

    // T-PB-06: 同じ記録の中では、2セット目は1セット目を含めて比べる
    it('T-PB-06 同じ記録の2セット目は、1セット目を含めて比べる', async () => {
      const cookie = await signUpAs('たろう');
      const r = await createRecord(cookie, DAY1);
      expect((await add(cookie, r, 1, 40, 10)).isPersonalBest).toBe(false); // 初めて
      expect((await add(cookie, r, 2, 40, 11)).isPersonalBest).toBe(true); // 440 > 400
      expect((await add(cookie, r, 3, 40, 11)).isPersonalBest).toBe(false); // 440 = 440 は超えていない
    });

    it('自己ベストは種目ごと・人ごと（別の種目・他の人の記録は過去に数えない）', async () => {
      const cookie = await signUpAs('たろう');
      const other = await signUpAs('はなこ');
      await add(cookie, await createRecord(cookie, DAY1), 1, 100, 100, SQUAT_ID);
      await add(other, await createRecord(other, DAY1), 1, 100, 100);
      expect((await add(cookie, await createRecord(cookie, DAY2), 1, 40, 10)).isPersonalBest).toBe(false); // 初めての種目なので付かない
    });
  });

  describe('再送（T-OFF-02・T-PB-05）', () => {
    // 1回目で自己ベストになったセットを再送しても、2回目は自分自身を過去に数えず、同じ判定・同じ result を返す
    it('同じ id の2回目は 200 で、1回目と同じ内容（result・isPersonalBest も同じ）', async () => {
      const cookie = await signUpAs('たろう');
      await add(cookie, await createRecord(cookie, DAY1), 1, 40, 10);
      const today = await createRecord(cookie, DAY2);
      const sent = send(cookie, today, 1, 45, 9); // 405 > 400 → up・自己ベスト
      const first = await sent.req().expect(201);
      expect(first.body).toMatchObject({ result: 'up', isPersonalBest: true });

      const second = await sent.req().expect(200);
      expect(second.body).toEqual(first.body);
    });

    it('再送の間に、後の日の記録が入っても判定は変わらない（自分より後の記録は見ない）', async () => {
      const cookie = await signUpAs('たろう');
      await add(cookie, await createRecord(cookie, DAY1), 1, 40, 10);
      const today = await createRecord(cookie, DAY2);
      const sent = send(cookie, today, 1, 45, 9);
      const first = await sent.req().expect(201);

      await add(cookie, await createRecord(cookie, DAY3), 1, 200, 10); // あとから、もっと重い記録
      expect((await sent.req().expect(200)).body).toEqual(first.body);
    });
  });

  describe('GET /exercises/{id}/previous', () => {
    const previous = (cookie: string, exerciseId: string, query = '') =>
      request(app.getHttpServer()).get(`/api/exercises/${exerciseId}/previous${query}`).set('Cookie', cookie);

    it('Cookie なしでは 401', async () => {
      await request(app.getHttpServer()).get(`/api/exercises/${BENCH_PRESS_ID}/previous`).expect(401);
    });

    it('記録が無ければ previous・personalBest とも null', async () => {
      const cookie = await signUpAs('たろう');
      const res = await previous(cookie, BENCH_PRESS_ID).expect(200);
      expect(res.body).toEqual({ previous: null, personalBest: null });
    });

    it('直近の記録のセット（セット番号の順）と、過去最大のセットを返す', async () => {
      const cookie = await signUpAs('たろう');
      const old = await createRecord(cookie, DAY1);
      await add(cookie, old, 1, 45, 10); // 450（過去最大）
      const recent = await createRecord(cookie, DAY2);
      await add(cookie, recent, 2, 40, 8);
      await add(cookie, recent, 1, 40, 10);

      const res = await previous(cookie, BENCH_PRESS_ID).expect(200);
      expect(res.body).toEqual({
        previous: {
          recordedAt: DAY2,
          sets: [
            { setNo: 1, weightKg: 40, reps: 10 },
            { setNo: 2, weightKg: 40, reps: 8 },
          ],
        },
        personalBest: { weightKg: 45, reps: 10, volume: 450 },
      });
    });

    it('before を付けると、その時刻より前の記録だけを見る（記録中の自分の記録を前回にしない）', async () => {
      const cookie = await signUpAs('たろう');
      await add(cookie, await createRecord(cookie, DAY1), 1, 40, 10);
      await add(cookie, await createRecord(cookie, DAY2), 1, 100, 10);

      const res = await previous(cookie, BENCH_PRESS_ID, `?before=${DAY2}`).expect(200);
      expect(res.body.previous.recordedAt).toBe(DAY1);
      expect(res.body.personalBest).toEqual({ weightKg: 40, reps: 10, volume: 400 });
    });

    it('before が日時でなければ 400（VALIDATION_ERROR）', async () => {
      const cookie = await signUpAs('たろう');
      const res = await previous(cookie, BENCH_PRESS_ID, '?before=yesterday').expect(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('他の人の記録は前回にならない', async () => {
      const cookie = await signUpAs('たろう');
      const other = await signUpAs('はなこ');
      await add(other, await createRecord(other, DAY1), 1, 40, 10);
      expect((await previous(cookie, BENCH_PRESS_ID).expect(200)).body).toEqual({ previous: null, personalBest: null });
    });

    it('存在しない種目・UUID でない id は 404（EXERCISE_NOT_FOUND）', async () => {
      const cookie = await signUpAs('たろう');
      for (const id of [randomUUID(), 'not-a-uuid']) {
        const res = await previous(cookie, id).expect(404);
        expect(res.body.code).toBe('EXERCISE_NOT_FOUND');
      }
    });

    it('他の人が追加した種目は 404（存在を教えない）', async () => {
      const cookie = await signUpAs('たろう');
      const other = await signUpAs('はなこ');
      const made = await request(app.getHttpServer()).post('/api/exercises').set('Cookie', other).send({ name: 'ヨガ', bodyPart: 'abs' }).expect(201);
      await previous(cookie, made.body.id).expect(404);
      await previous(other, made.body.id).expect(200);
    });
  });
});
