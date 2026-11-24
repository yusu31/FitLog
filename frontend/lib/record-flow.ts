// 記録画面（S-12）の純粋な計算（features.md 2.3・2.5・2.6、docs/testing-design.md 3-1・3-2）。
// 比べ方・自己ベストの判定は共通の関数（lib/shared/ghost.ts）を使い、ここでは画面ならではの決まりだけを持つ。
import type { PreviousSetResponse } from '@/lib/api/generated';
import { isRestReturn, suggestNext } from '@/lib/menu-suggestion';
import { compareSet, isPersonalBest, volumeOf, type GhostResult, type SetValue } from '@/lib/shared/ghost';

export type { SetValue } from '@/lib/shared/ghost';

// --- 1回の運動の区切り（既定 3時間。design.md 7章。画面が判定し、API は区切りを知らない） ---
export const SPLIT_GAP_MS = 3 * 60 * 60 * 1000;

// 最後のセットから3時間以上あいていたら（ちょうど3時間も）別の記録。セットがまだ無ければ新しい記録
export const shouldStartNewRecord = (lastSetAtMs: number | null, nowMs: number): boolean =>
  lastSetAtMs === null || nowMs - lastSetAtMs >= SPLIT_GAP_MS;

// --- 重量・回数の範囲と「＋/−」（回数 ±1・重量 ±2.5kg。範囲は design.md の API と同じ） ---
export const WEIGHT_MIN = 0;
export const WEIGHT_MAX = 500;
export const WEIGHT_STEP = 2.5;
// 20→60kg を16回押さなくて済むように、重量には大きい動かし方（±10kg）も置く（E1）
export const WEIGHT_BIG_STEP = 10;
export const REPS_MIN = 1;
export const REPS_MAX = 999;

// 重量は 0.5 刻みにそろえて範囲に収める。数でない値（空欄など）は下端
export const clampWeight = (w: number): number =>
  Number.isFinite(w) ? Math.min(WEIGHT_MAX, Math.max(WEIGHT_MIN, Math.round(w * 2) / 2)) : WEIGHT_MIN;

// 回数は整数にそろえて範囲に収める。数でない値は下端
export const clampReps = (r: number): number =>
  Number.isFinite(r) ? Math.min(REPS_MAX, Math.max(REPS_MIN, Math.round(r))) : REPS_MIN;

export const stepWeight = (w: number, dir: 1 | -1): number => clampWeight(w + dir * WEIGHT_STEP);
export const stepWeightBig = (w: number, dir: 1 | -1): number => clampWeight(w + dir * WEIGHT_BIG_STEP);
export const stepReps = (r: number, dir: 1 | -1): number => clampReps(r + dir);

// --- 最初に入る値 ---
export type DraftSource = 'previous' | 'trial' | 'none';
// target: 今日の目標（前回の同じ番号のセットから決める。前回の値と同じセットの話にする。L12）。入力欄の横に小さく出す。前回があるときだけ
// restReturn: 休み明けで、目標が前回と同じ値のとき（理由を1行出す印。A02-5）
export type InitialDraft = { draft: SetValue; ghost: SetValue | null; source: DraftSource; target?: SetValue; restReturn?: true };

// 前回の同じセット番号 → 無ければ前回の最後のセット → 前回が無ければ種目のお試し値 → どれも無ければ空（0kg × 10回）。
// 入力の初期値は「前回の値」そのもの（前回のバー・今日の画面の「前回」と一致させる。D3 L12）。
// 目標（二重漸進法）は初期値にせず target に分けて返し、画面が入力欄の横に出す。
// ghost は「前回のバー」に出す比べる相手。お試しのときは「お試し」の札つきで出し、結果の比べには使わない（source で見分ける）
export function initialDraft(
  previousSets: readonly PreviousSetResponse[] | undefined,
  setNo: number,
  trial: SetValue | null,
  // 渡すと、目標（target）も返す。daysSince は前回からのあいた日数
  goal?: { daysSince: number | null },
): InitialDraft {
  if (previousSets && previousSets.length > 0) {
    const last = previousSets[previousSets.length - 1];
    const same = previousSets.find((s) => s.setNo === setNo) ?? last;
    const base = { draft: { weightKg: same.weightKg, reps: same.reps }, ghost: same, source: 'previous' as const };
    if (!goal) return base;
    const target = suggestNext({ weightKg: same.weightKg, reps: same.reps }, goal.daysSince);
    return { ...base, target, ...(isRestReturn(goal.daysSince) ? { restReturn: true as const } : {}) };
  }
  if (trial) return { draft: { ...trial }, ghost: { ...trial }, source: 'trial' };
  return { draft: { weightKg: 0, reps: 10 }, ghost: null, source: 'none' };
}

// 消して穴があいても、いちばん大きい番号の次にする（番号が重なると API が 409 を返すため）
export const nextSetNo = (sets: readonly { setNo: number }[]): number =>
  sets.reduce((max, s) => Math.max(max, s.setNo), 0) + 1;

// 「前回超え +N」の N。重量が同じなら回数の差、違えば 重量×回数 の差（比べ方と同じ考え方）
export const ghostDiff = (previous: SetValue, current: SetValue): number =>
  previous.weightKg === current.weightKg ? current.reps - previous.reps : volumeOf(current) - volumeOf(previous);

// 応答を待たずに出す仮の結果。API の応答が正で、違えば画面を直す
export function provisionalResult(
  ghost: SetValue | null,
  current: SetValue,
  pastMaxVolume: number | null,
): { result: GhostResult | null; isPersonalBest: boolean } {
  return {
    result: ghost ? compareSet(ghost, current) : null,
    isPersonalBest: isPersonalBest(current, pastMaxVolume),
  };
}

// 仲間のゴースト（F-16）に出す値。仲間の前回の、同じセット番号 → 無ければ最後のセット。前回が無ければ null
export function friendGhostValue(previousSets: readonly PreviousSetResponse[] | undefined | null, setNo: number): SetValue | null {
  if (!previousSets || previousSets.length === 0) return null;
  const same = previousSets.find((s) => s.setNo === setNo) ?? previousSets[previousSets.length - 1];
  return { weightKg: same.weightKg, reps: same.reps };
}
