import { randomUUID } from 'node:crypto';
import { request, type APIRequestContext } from '@playwright/test';

// 総合テスト（02-8）のシードデータ。API 経由で、ローカルの結合テスト専用 DB（fitlog_test）にだけ作る。
// 接続先の安全装置は playwright.config.ts（guard.ts）が働く。ここは API を呼ぶだけ。

// 固定する「今日」。2026-11-18（水）09:00 JST。
// サーバーは「5分より先の未来の記録」を拒否するので、実時刻より前の日にする（実施日より後なら必ず通る）
export const AUDIT_NOW = '2026-11-18T09:00:00+09:00';
export const PASSWORD = 'audit-password-1234';

// 今日から daysAgo 日前の hour:min（日本時間）を ISO 8601 で返す
export function at(daysAgo: number, hour: number, min = 0): string {
  const d = new Date(Date.UTC(2026, 10, 18 - daysAgo, hour - 9, min));
  return d.toISOString();
}

export type SeedUser = { key: string; name: string; email: string; id: string };
export type SeedResult = {
  suffix: string;
  password: string;
  users: Record<string, SeedUser>;
  groupToken: string;
  // 状態の別名: new=記録0／active=昨日まで記録あり・グループあり／back6=最後の記録が6日前・グループなし／solo=記録あり・グループなし
  states: Record<'new' | 'active' | 'back6' | 'solo', string>;
};

type Exercise = { id: string; name: string };

async function signUp(baseURL: string, name: string, email: string): Promise<{ ctx: APIRequestContext; id: string }> {
  const ctx = await request.newContext({ baseURL, extraHTTPHeaders: { Origin: baseURL } });
  const res = await ctx.post('/api/auth/sign-up/email', { data: { name, email, password: PASSWORD } });
  if (!res.ok()) throw new Error(`sign-up 失敗 ${email}: ${res.status()} ${await res.text()}`);
  const json = (await res.json()) as { user: { id: string } };
  return { ctx, id: json.user.id };
}

async function post<T = unknown>(ctx: APIRequestContext, path: string, data?: unknown): Promise<T> {
  const res = await ctx.post(path, data === undefined ? {} : { data });
  if (!res.ok()) throw new Error(`POST ${path} 失敗: ${res.status()} ${await res.text()}`);
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

type SetSpec = { exercise: string; sets: [number, number][] };

async function addWorkout(ctx: APIRequestContext, exercises: Exercise[], when: string, specs: SetSpec[], opts: { end?: boolean } = {}): Promise<string> {
  const id = randomUUID();
  await post(ctx, '/api/records', { id, kind: 'workout', recordedAt: when });
  for (const spec of specs) {
    const ex = exercises.find((e) => e.name === spec.exercise);
    if (!ex) throw new Error(`種目が見つかりません: ${spec.exercise}`);
    for (const [i, [kg, reps]] of spec.sets.entries()) {
      await post(ctx, `/api/records/${id}/sets`, { id: randomUUID(), exerciseId: ex.id, setNo: i + 1, weightKg: kg, reps });
    }
  }
  if (opts.end !== false) await post(ctx, `/api/records/${id}/end`);
  return id;
}

// 東京の皇居まわりを走ったことにする点列（経度・緯度）。GPX を取り込んだときと同じ LineString
function loopRoute(points = 24): { type: 'LineString'; coordinates: [number, number][] } {
  const coordinates: [number, number][] = [];
  for (let i = 0; i <= points; i++) {
    const t = (i / points) * Math.PI * 2;
    coordinates.push([139.7528 + 0.012 * Math.cos(t), 35.6852 + 0.009 * Math.sin(t)]);
  }
  return { type: 'LineString', coordinates };
}

async function addRun(ctx: APIRequestContext, when: string, distanceM: number, durationS: number, withRoute = false): Promise<string> {
  const id = randomUUID();
  await post(ctx, '/api/records', { id, kind: 'run', recordedAt: when, run: { distanceM, durationS, ...(withRoute ? { route: loopRoute() } : {}) } });
  return id;
}

// 動画つきの記録にする（F-13）。置く先（S3）には何も置かず、動画の行（POST /records/{id}/video）だけ作る。
// 画面に出る動画の本体は、ui.audit.ts が見本の動画（sample-2s.mp4）に差し替えて返す。
// 署名は手元の計算だけで作られるので、API を VIDEO_BUCKET（ダミーの名前）と AWS_ACCESS_KEY_ID／AWS_SECRET_ACCESS_KEY（ダミー）つきで起動しておく。
// 無い環境では 503 になり動画つきの記録は作れない（ほかの検査は止めずに進める）
async function attachVideo(ctx: APIRequestContext, recordId: string): Promise<void> {
  const res = await ctx.post(`/api/records/${recordId}/video`, { data: { contentType: 'video/mp4', sizeBytes: 6664 } });
  if (!res.ok()) console.warn(`動画の行を作れませんでした（${res.status()}）。API に VIDEO_BUCKET を設定すると動画つきで撮れます`);
}

const BENCH: SetSpec = { exercise: 'ベンチプレス', sets: [[40, 10], [40, 10], [42.5, 8]] };

export async function seedAll(baseURL: string): Promise<SeedResult> {
  const suffix = randomUUID().slice(0, 6);
  const email = (key: string) => `audit-${key}-${suffix}@example.com`;
  const users: Record<string, SeedUser> = {};
  const ctxs: Record<string, APIRequestContext> = {};

  // 5人まで（グループの上限）: 仲間3人＋本人役（active）。別に new・back6・solo の3人はグループに入れない
  const roster: [string, string][] = [
    ['active', 'ミク'],
    ['yusuke', 'ユウスケ'],
    ['aya', 'アヤ'],
    ['takashi', 'タカシ'],
    ['new', 'あたらしい人'],
    ['back6', 'ケンタ'],
    ['solo', 'ヨシコ'],
  ];
  for (const [key, name] of roster) {
    const { ctx, id } = await signUp(baseURL, name, email(key));
    ctxs[key] = ctx;
    users[key] = { key, name, email: email(key), id };
  }

  const list = await ctxs.active.get('/api/exercises');
  const exList = (await list.json()) as Exercise[];
  if (exList.length === 0) throw new Error('種目の一覧が空です（マイグレーションの種目データを確認）');

  // グループ: タカシが作り、招待リンクで3人が入る
  await post(ctxs.takashi, '/api/groups', { name: 'ほぐし会' });
  const inv = await post<{ token: string }>(ctxs.takashi, '/api/groups/current/invitations');
  for (const key of ['active', 'yusuke', 'aya']) await post(ctxs[key], `/api/invitations/${inv.token}/accept`);

  // 本人役（active）: 2週間分。昨日まで。今日はまだ記録なし
  const squat: SetSpec = { exercise: 'スクワット', sets: [[60, 10], [60, 10], [65, 8]] };
  const activeLast = await addWorkout(ctxs.active, exList, at(1, 19, 0), [BENCH, squat]);
  // 今週、本人も動画を撮っている（仲間の動画が見られる状態＝再生マークが出る状態を作る）
  await attachVideo(ctxs.active, activeLast);
  for (const days of [3, 4, 6, 8, 10, 13]) await addWorkout(ctxs.active, exList, at(days, 19, 0), [BENCH]);
  await addRun(ctxs.active, at(2, 7, 0), 5200, 1740, true);
  await addRun(ctxs.active, at(9, 7, 0), 3000, 1080);
  await addRun(ctxs.active, at(12, 7, 0), 4100, 1500);
  await post(ctxs.active, '/api/routines', { name: '胸と脚の日', recordId: activeLast });

  // 仲間: 今週（月曜 11/16〜今日 11/18）の足跡
  const wRecords: string[] = [];
  wRecords.push(await addWorkout(ctxs.yusuke, exList, at(0, 7, 30), [BENCH, squat]));
  await attachVideo(ctxs.yusuke, wRecords[0]!);
  wRecords.push(await addWorkout(ctxs.yusuke, exList, at(2, 19, 0), [BENCH]));
  const ayaRun = await addRun(ctxs.aya, at(0, 6, 30), 8000, 2700, true);
  await addRun(ctxs.aya, at(1, 6, 30), 5000, 1700);
  const takashiWorkout = await addWorkout(ctxs.takashi, exList, at(1, 18, 0), [squat]);
  // 休みの日の足跡（休みスタンプ用）
  await post(ctxs.takashi, '/api/records', { id: randomUUID(), kind: 'rest', recordedAt: at(0, 8, 0) });

  // 反応とコメント: 仲間→本人の記録、本人→仲間の記録
  await post(ctxs.yusuke, `/api/records/${activeLast}/reactions`, { id: randomUUID(), stampKey: 'fire' });
  await post(ctxs.aya, `/api/records/${activeLast}/reactions`, { id: randomUUID(), stampKey: 'nice' });
  await post(ctxs.aya, `/api/records/${activeLast}/comments`, { id: randomUUID(), body: 'いい重量！' });
  await post(ctxs.active, `/api/records/${wRecords[0]}/reactions`, { id: randomUUID(), stampKey: 'clap' });
  await post(ctxs.active, `/api/records/${ayaRun}/reactions`, { id: randomUUID(), stampKey: 'smile' });
  await post(ctxs.yusuke, `/api/records/${takashiWorkout}/comments`, { id: randomUUID(), body: 'スクワットきつそう' });

  // back6: 最後の記録が6日前（おかえり表示の確認）
  await addWorkout(ctxs.back6, exList, at(6, 19, 0), [BENCH]);
  await addWorkout(ctxs.back6, exList, at(9, 19, 0), [BENCH]);
  // solo: グループなしで記録あり
  await addWorkout(ctxs.solo, exList, at(1, 10, 0), [squat]);
  await addRun(ctxs.solo, at(3, 8, 0), 2500, 1500);

  for (const c of Object.values(ctxs)) await c.dispose();
  return {
    suffix,
    password: PASSWORD,
    users,
    groupToken: inv.token,
    states: { new: 'new', active: 'active', back6: 'back6', solo: 'solo' },
  };
}
