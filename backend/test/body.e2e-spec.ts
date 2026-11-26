import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createApp, migrateDb, resetDb, TEST_ORIGIN, withPool } from './helpers/app.js';

// からだ（B14a）。体重・身長・BMI・7日平均・推定消費カロリー・推定1RM・プロフィールの結合テスト。
// 体重と身長は本人だけ。プロフィール（ひとこと等）は同じグループの仲間だけが見られ、他人には 404（存在を教えない）。
// 本物の PostgreSQL・本物の better-auth。DATABASE_URL が無ければ「落ちる」（飛ばさない）
const url = process.env.DATABASE_URL;

const cookieOf = (res: request.Response): string =>
  (res.headers['set-cookie'] as unknown as string[]).map((c) => c.split(';')[0]).join('; ');

const SQUAT_ID = '00000000-0000-4000-8000-000000000024';
const NOON = '2026-10-26T03:00:00.000Z';

describe('からだ（結合: 本物の PostgreSQL・better-auth）', () => {
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
  const signUp = async (): Promise<{ cookie: string; id: string; name: string }> => {
    const name = `ユーザー${++userSeq}`;
    const res = await http()
      .post('/api/auth/sign-up/email')
      .set('Origin', TEST_ORIGIN)
      .send({ email: `bd${userSeq}@example.com`, password: 'correct-horse-battery', name })
      .expect(200);
    return { cookie: cookieOf(res), id: (res.body as { user: { id: string } }).user.id, name };
  };
  const putWeight = (cookie: string, date: string, kg: unknown) => http().put(`/api/body/weights/${date}`).set('Cookie', cookie).send({ kg });
  const getBody = async (cookie: string) => (await http().get('/api/body').set('Cookie', cookie).expect(200)).body;
  const EMPTY = { heightCm: null, latest: null, bmi: null, avg7: null, deltaFromPrevious: null, weights: [] };

  it('T-BODY-00 ログインしていないと全部 401', async () => {
    await http().get('/api/body').expect(401);
    await http().put('/api/body/height').send({ heightCm: 170 }).expect(401);
    await http().put('/api/body/weights/2026-10-26').send({ kg: 60 }).expect(401);
    await http().delete('/api/body/weights/2026-10-26').expect(401);
    await http().get('/api/body/one-rm').expect(401);
    await http().get(`/api/body/exercises/${SQUAT_ID}/max-weights`).expect(401);
    await http().get(`/api/body/calories/${randomUUID()}`).expect(401);
    await http().get('/api/body/profile').expect(401);
    await http().put('/api/body/profile').send({}).expect(401);
  });

  describe('体重・身長・BMI', () => {
    it('T-BODY-01 何も入れていない人は、すべて null・空の一覧', async () => {
      const me = await signUp();
      expect(await getBody(me.cookie)).toEqual(EMPTY);
    });

    it('T-BODY-02 身長と体重から BMI を出す。判定の言葉は返さない（70kg・170cm → 24.2）', async () => {
      const me = await signUp();
      await http().put('/api/body/height').set('Cookie', me.cookie).send({ heightCm: 170 }).expect(200);
      await putWeight(me.cookie, '2026-10-26', 70).expect(200);
      const body = await getBody(me.cookie);
      expect(body.heightCm).toBe(170);
      expect(body.latest).toEqual({ date: '2026-10-26', kg: 70 });
      expect(body.bmi).toBe(24.2);
      expect(JSON.stringify(body)).not.toMatch(/肥満|標準|普通|やせ|overweight|obese/);
    });

    it('T-BODY-03 身長が無ければ BMI は null。身長は null で消せる', async () => {
      const me = await signUp();
      await putWeight(me.cookie, '2026-10-26', 70).expect(200);
      expect((await getBody(me.cookie)).bmi).toBeNull();
      await http().put('/api/body/height').set('Cookie', me.cookie).send({ heightCm: 170 }).expect(200);
      await http().put('/api/body/height').set('Cookie', me.cookie).send({ heightCm: null }).expect(200);
      expect((await getBody(me.cookie)).heightCm).toBeNull();
    });

    it('T-BODY-04 同じ日は上書き（1日1行）。別の日は足される', async () => {
      const me = await signUp();
      await putWeight(me.cookie, '2026-10-26', 70).expect(200);
      await putWeight(me.cookie, '2026-10-26', 69.5).expect(200);
      await putWeight(me.cookie, '2026-10-27', 69).expect(200);
      const body = await getBody(me.cookie);
      expect(body.weights.map((w: { date: string; kg: number }) => [w.date, w.kg])).toEqual([
        ['2026-10-26', 69.5],
        ['2026-10-27', 69],
      ]);
      const n = await withPool(url!, (pool) => pool.query('select count(*)::int as n from body_weights'));
      expect(n.rows[0].n).toBe(2);
    });

    it('T-BODY-05 7日平均と前回からの増減。直近7日（最新の日を含む）だけを平均する', async () => {
      const me = await signUp();
      await putWeight(me.cookie, '2026-10-01', 100).expect(200); // 7日の外
      await putWeight(me.cookie, '2026-10-20', 70).expect(200); // 10/26 の7日間は 10/20〜10/26（境目: 含む）
      await putWeight(me.cookie, '2026-10-24', 71).expect(200);
      await putWeight(me.cookie, '2026-10-26', 72).expect(200);
      const body = await getBody(me.cookie);
      expect(body.avg7).toBe(71);
      expect(body.deltaFromPrevious).toBe(1);
      // 一覧の各点にも、その日までの7日平均が付く
      expect(body.weights.at(-1)).toEqual({ date: '2026-10-26', kg: 72, avg7: 71 });
    });

    it('T-BODY-06 消せる。消した日をもう一度消すと 404', async () => {
      const me = await signUp();
      await putWeight(me.cookie, '2026-10-26', 70).expect(200);
      await http().delete('/api/body/weights/2026-10-26').set('Cookie', me.cookie).expect(204);
      await http().delete('/api/body/weights/2026-10-26').set('Cookie', me.cookie).expect(404);
      expect((await getBody(me.cookie)).weights).toEqual([]);
    });

    it('T-BODY-07 本人だけが見える。他人の体重・身長は一覧にも出ず、他人の日を消そうとしても 404', async () => {
      const a = await signUp();
      const b = await signUp();
      await putWeight(a.cookie, '2026-10-26', 70).expect(200);
      await http().put('/api/body/height').set('Cookie', a.cookie).send({ heightCm: 170 }).expect(200);
      expect(await getBody(b.cookie)).toEqual(EMPTY);
      await http().delete('/api/body/weights/2026-10-26').set('Cookie', b.cookie).expect(404);
      expect((await getBody(a.cookie)).weights).toHaveLength(1);
    });

    it.each([
      ['体重 19.9', '2026-10-26', 19.9],
      ['体重 300.1', '2026-10-26', 300.1],
      ['体重 70.05（0.1刻みでない）', '2026-10-26', 70.05],
      ['体重が文字', '2026-10-26', '70'],
      ['実在しない日', '2026-02-30', 70],
      ['未来の日', '2999-01-01', 70],
    ])('T-BODY-08 体重の入力エラー: %s は 400', async (_n, date, kg) => {
      const me = await signUp();
      const res = await putWeight(me.cookie, date, kg).expect(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it.each([99.9, 250.1, '170', undefined])('T-BODY-09 身長 %s は 400', async (v) => {
      const me = await signUp();
      await http().put('/api/body/height').set('Cookie', me.cookie).send({ heightCm: v }).expect(400);
    });

    it('T-BODY-10 身長 100・250、体重 20・300 の境目は通る', async () => {
      const me = await signUp();
      await http().put('/api/body/height').set('Cookie', me.cookie).send({ heightCm: 100 }).expect(200);
      await http().put('/api/body/height').set('Cookie', me.cookie).send({ heightCm: 250 }).expect(200);
      await putWeight(me.cookie, '2026-10-25', 20).expect(200);
      await putWeight(me.cookie, '2026-10-26', 300).expect(200);
    });
  });

  const workout = async (cookie: string, sets: Array<[string, number, number]>, at = NOON): Promise<string> => {
    const id = randomUUID();
    await http().post('/api/records').set('Cookie', cookie).send({ id, kind: 'workout', recordedAt: at }).expect(201);
    const counts = new Map<string, number>();
    for (const [exerciseId, weightKg, reps] of sets) {
      const setNo = (counts.get(exerciseId) ?? 0) + 1;
      counts.set(exerciseId, setNo);
      await http().post(`/api/records/${id}/sets`).set('Cookie', cookie).send({ id: randomUUID(), exerciseId, setNo, weightKg, reps }).expect(201);
    }
    return id;
  };

  describe('推定1RM', () => {
    it('T-BODY-11 種目ごとに、いちばん高い推定1RM（Epley）を返す', async () => {
      const me = await signUp();
      await workout(me.cookie, [
        [SQUAT_ID, 60, 10],
        [SQUAT_ID, 50, 13],
      ]);
      const res = await http().get('/api/body/one-rm').set('Cookie', me.cookie).expect(200);
      expect(res.body.items).toHaveLength(1);
      // 60×10 → 80 ／ 50×13 → 71.7。高いほうは 80
      expect(res.body.items[0]).toMatchObject({ exerciseId: SQUAT_ID, kg: 80, weightKg: 60, reps: 10, approximate: false });
    });

    it('T-BODY-12 13回のセットしか無い種目は approximate: true', async () => {
      const me = await signUp();
      await workout(me.cookie, [[SQUAT_ID, 60, 13]]);
      const res = await http().get('/api/body/one-rm').set('Cookie', me.cookie).expect(200);
      expect(res.body.items[0]).toMatchObject({ kg: 86, approximate: true });
    });

    it('T-BODY-13 他人の記録は混ざらない。記録が無ければ空', async () => {
      const a = await signUp();
      const b = await signUp();
      await workout(a.cookie, [[SQUAT_ID, 100, 5]]);
      expect((await http().get('/api/body/one-rm').set('Cookie', b.cookie).expect(200)).body).toEqual({ items: [] });
    });
  });

  describe('種目の最大重量の推移', () => {
    const maxWeights = (cookie: string, id: string) => http().get(`/api/body/exercises/${id}/max-weights`).set('Cookie', cookie);

    it('T-BODY-14 日ごとの最大重量を、日付の昇順で返す', async () => {
      const me = await signUp();
      await workout(me.cookie, [[SQUAT_ID, 60, 10], [SQUAT_ID, 80, 3]], '2026-10-27T03:00:00.000Z');
      await workout(me.cookie, [[SQUAT_ID, 70, 5]], '2026-10-26T03:00:00.000Z');
      const res = await maxWeights(me.cookie, SQUAT_ID).expect(200);
      expect(res.body).toEqual({ exerciseId: SQUAT_ID, name: expect.any(String), points: [{ date: '2026-10-26', kg: 70 }, { date: '2026-10-27', kg: 80 }] });
    });

    it('T-BODY-15 自重（0kg）だけの日は点にしない。記録が無ければ points は空', async () => {
      const me = await signUp();
      await workout(me.cookie, [[SQUAT_ID, 0, 20]]);
      expect((await maxWeights(me.cookie, SQUAT_ID).expect(200)).body.points).toEqual([]);
    });

    it('T-BODY-16 他人のセットは混ざらない', async () => {
      const a = await signUp();
      const b = await signUp();
      await workout(a.cookie, [[SQUAT_ID, 100, 5]]);
      expect((await maxWeights(b.cookie, SQUAT_ID).expect(200)).body.points).toEqual([]);
    });

    it('T-BODY-17 UUID でない・無い種目は 404 EXERCISE_NOT_FOUND', async () => {
      const me = await signUp();
      for (const id of ['abc', randomUUID()]) {
        const res = await maxWeights(me.cookie, id).expect(404);
        expect(res.body.code).toBe('EXERCISE_NOT_FOUND');
      }
    });

    it('T-BODY-18 他人が足した種目は 404（存在を教えない）', async () => {
      const a = await signUp();
      const b = await signUp();
      const made = await http().post('/api/exercises').set('Cookie', a.cookie).send({ name: '自分だけの種目', bodyPart: 'abs' });
      expect(made.status).toBe(201);
      await maxWeights(a.cookie, made.body.id).expect(200);
      await maxWeights(b.cookie, made.body.id).expect(404);
    });
  });

  describe('推定消費カロリー', () => {
    const run = async (cookie: string, distanceM: number, durationS: number): Promise<string> => {
      const id = randomUUID();
      await http().post('/api/records').set('Cookie', cookie).send({ id, kind: 'run', recordedAt: NOON, run: { distanceM, durationS } }).expect(201);
      return id;
    };
    const cal = (cookie: string, id: string) => http().get(`/api/body/calories/${id}`).set('Cookie', cookie);

    it('T-BODY-14 ラン: 10km を 1時間（10km/h → 9.3メッツ）・60kg → 9.3×1×60×1.05 = 586', async () => {
      const me = await signUp();
      await putWeight(me.cookie, '2026-10-26', 60).expect(200);
      const id = await run(me.cookie, 10000, 3600);
      const res = await cal(me.cookie, id).expect(200);
      expect(res.body).toEqual({ recordId: id, kcal: 586, mets: 9.3, durationSec: 3600, weightKg: 60, reason: null });
    });

    it('T-BODY-15 体重が無ければ kcal は null（NO_WEIGHT）。記録の日より後の体重は使わない', async () => {
      const me = await signUp();
      const id = await run(me.cookie, 10000, 3600);
      expect((await cal(me.cookie, id).expect(200)).body).toMatchObject({ kcal: null, reason: 'NO_WEIGHT' });
      await putWeight(me.cookie, '2026-10-27', 60).expect(200); // 記録は 10/26
      expect((await cal(me.cookie, id).expect(200)).body).toMatchObject({ kcal: null, reason: 'NO_WEIGHT' });
    });

    it('T-BODY-16 歩く速さ（4.2km/h 未満）のランは null（TOO_SLOW）', async () => {
      const me = await signUp();
      await putWeight(me.cookie, '2026-10-26', 60).expect(200);
      const id = await run(me.cookie, 4000, 3600);
      expect((await cal(me.cookie, id).expect(200)).body).toMatchObject({ kcal: null, reason: 'TOO_SLOW' });
    });

    it('T-BODY-17 筋トレ: 最初のセット〜最後のセットの時間で 3.5メッツ。1セットだけなら null（NO_DURATION）', async () => {
      const me = await signUp();
      await putWeight(me.cookie, '2026-10-26', 60).expect(200);
      const id = randomUUID();
      await http().post('/api/records').set('Cookie', me.cookie).send({ id, kind: 'workout', recordedAt: NOON }).expect(201);
      const s1 = randomUUID();
      const s2 = randomUUID();
      await http().post(`/api/records/${id}/sets`).set('Cookie', me.cookie).send({ id: s1, exerciseId: SQUAT_ID, setNo: 1, weightKg: 60, reps: 10 }).expect(201);
      expect((await cal(me.cookie, id).expect(200)).body).toMatchObject({ kcal: null, reason: 'NO_DURATION' });
      await http().post(`/api/records/${id}/sets`).set('Cookie', me.cookie).send({ id: s2, exerciseId: SQUAT_ID, setNo: 2, weightKg: 60, reps: 10 }).expect(201);
      // セットの時刻を 1時間 離す
      await withPool(url!, (pool) => pool.query(`update workout_sets set created_at = '2026-10-26T03:00:00Z' where id = $1`, [s1]));
      await withPool(url!, (pool) => pool.query(`update workout_sets set created_at = '2026-10-26T04:00:00Z' where id = $1`, [s2]));
      const res = await cal(me.cookie, id).expect(200);
      expect(res.body).toEqual({ recordId: id, kcal: 221, mets: 3.5, durationSec: 3600, weightKg: 60, reason: null });
    });

    it('T-BODY-18 他人の記録・存在しない記録・UUID でない id は 404（存在を教えない）', async () => {
      const a = await signUp();
      const b = await signUp();
      await putWeight(b.cookie, '2026-10-26', 60).expect(200);
      const id = await run(a.cookie, 10000, 3600);
      await cal(b.cookie, id).expect(404);
      await cal(b.cookie, randomUUID()).expect(404);
      await cal(b.cookie, 'not-a-uuid').expect(404);
    });
  });

  describe('プロフィール', () => {
    const putProfile = (cookie: string, body: unknown) => http().put('/api/body/profile').set('Cookie', cookie).send(body as object);
    const makeGroup = async (userIds: string[]) => {
      const groupId = randomUUID();
      await withPool(url!, async (pool) => {
        await pool.query(`insert into groups (id, name) values ($1, 'テスト')`, [groupId]);
        for (const u of userIds) await pool.query(`insert into group_members (group_id, user_id) values ($1, $2)`, [groupId, u]);
      });
    };

    it('T-BODY-19 初期は全部 null。保存して読み返せる', async () => {
      const me = await signUp();
      expect((await http().get('/api/body/profile').set('Cookie', me.cookie).expect(200)).body).toEqual({ userId: me.id, name: me.name, bio: null, favoriteKind: null, activeTime: null });
      await putProfile(me.cookie, { bio: '朝ランしてます', favoriteKind: 'both', activeTime: 'morning' }).expect(200);
      expect((await http().get('/api/body/profile').set('Cookie', me.cookie).expect(200)).body).toMatchObject({ bio: '朝ランしてます', favoriteKind: 'both', activeTime: 'morning' });
    });

    it('T-BODY-20 ひとこと 40字は通り、41字は 400。決まった値以外も 400', async () => {
      const me = await signUp();
      await putProfile(me.cookie, { bio: 'あ'.repeat(40) }).expect(200);
      await putProfile(me.cookie, { bio: 'あ'.repeat(41) }).expect(400);
      await putProfile(me.cookie, { favoriteKind: 'yoga' }).expect(400);
      await putProfile(me.cookie, { activeTime: 'evening' }).expect(400);
    });

    it('T-BODY-21 保存は置き換え。送らなかった欄は空になる', async () => {
      const me = await signUp();
      await putProfile(me.cookie, { bio: 'a', favoriteKind: 'run', activeTime: 'night' }).expect(200);
      await putProfile(me.cookie, { bio: 'b' }).expect(200);
      expect((await http().get('/api/body/profile').set('Cookie', me.cookie).expect(200)).body).toMatchObject({ bio: 'b', favoriteKind: null, activeTime: null });
    });

    it('T-BODY-22 同じグループの仲間のプロフィールは見える。体重・身長は含まれない', async () => {
      const a = await signUp();
      const b = await signUp();
      await makeGroup([a.id, b.id]);
      await putProfile(a.cookie, { bio: 'よろしく', favoriteKind: 'workout', activeTime: 'night' }).expect(200);
      await http().put('/api/body/height').set('Cookie', a.cookie).send({ heightCm: 170 }).expect(200);
      const res = await http().get(`/api/body/profile/${a.id}`).set('Cookie', b.cookie).expect(200);
      expect(res.body).toEqual({ userId: a.id, name: a.name, bio: 'よろしく', favoriteKind: 'workout', activeTime: 'night' });
    });

    it('T-BODY-23 他のグループの人・グループに入っていない人・存在しない人のプロフィールは 404', async () => {
      const a = await signUp();
      const b = await signUp();
      const c = await signUp();
      await makeGroup([a.id]);
      await makeGroup([b.id]);
      await http().get(`/api/body/profile/${a.id}`).set('Cookie', b.cookie).expect(404); // 別グループ
      await http().get(`/api/body/profile/${a.id}`).set('Cookie', c.cookie).expect(404); // 自分はグループ無し
      await http().get('/api/body/profile/no-such-user').set('Cookie', a.cookie).expect(404);
    });
  });
});
