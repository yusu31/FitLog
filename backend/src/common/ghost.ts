// ゴースト（前回の自分との比べ方）と自己ベストの判定（docs/design.md 7章・決定14）。
// 画面と API が同じ関数を使い、結果が割れないようにする（画面は応答を待たず仮表示し、API の応答が正）。
// 画面側への取り込みは画面の PR で行う。純粋な関数だけを置く（DB・Nest に依存しない）。

export type SetValue = { weightKg: number; reps: number };
export type GhostResult = 'up' | 'same' | 'down';

// 重量×回数。重量は 0.5 刻みなので、浮動小数点でも誤差なく表せる
export const volumeOf = (s: SetValue): number => s.weightKg * s.reps;

// 重量が同じなら回数、違えば重量×回数で比べる。重量 0（自重）同士は volume がどちらも 0 になるので、必ず回数で比べる
export const compareSet = (previous: SetValue, current: SetValue): GhostResult => {
  const a = previous.weightKg === current.weightKg ? previous.reps : volumeOf(previous);
  const b = previous.weightKg === current.weightKg ? current.reps : volumeOf(current);
  if (b > a) return 'up';
  if (b < a) return 'down';
  return 'same';
};

// 過去最大の volume を超えたら true（同じは false）。過去が無い（その種目の初めての記録）ときは比べる相手がいないので false
export const isPersonalBest = (current: SetValue, pastMaxVolume: number | null): boolean =>
  pastMaxVolume !== null && volumeOf(current) > pastMaxVolume;
