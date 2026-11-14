// メニュー提案（F-23）。前回の最後のセットから、今日の目標を決める純粋な関数。
// ルールは二重漸進法: 回数を1回ずつ増やし、上限に着いたら重さを上げて回数を下限に戻す。
// 数値は文章を作る AI ではなくここで決める（AI に数値を決めさせない方針）。
// 上限・下限・刻みは仮置き（本人未確認）。
import type { SetValue } from '@/lib/today-menu';

export const REP_MAX = 12;
export const REP_MIN = 8;
export const WEIGHT_STEP_KG = 2.5;

export function suggestNext(last: SetValue): SetValue {
  // 自重（0kg）は上げる重さが無いので、回数だけ増やす
  if (last.weightKg === 0) return { weightKg: 0, reps: last.reps + 1 };
  if (last.reps >= REP_MAX) return { weightKg: last.weightKg + WEIGHT_STEP_KG, reps: REP_MIN };
  return { weightKg: last.weightKg, reps: last.reps + 1 };
}
