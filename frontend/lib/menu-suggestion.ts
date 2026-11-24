// メニュー提案（F-23）。前回のセット（これから入れるのと同じ番号）から、今日の目標を決める純粋な関数。
// ルールは二重漸進法: 回数を1回ずつ増やし、上限に着いたら重さを上げて回数を下限に戻す。
// 数値は文章を作る AI ではなくここで決める（AI に数値を決めさせない方針）。
// 上限・下限・刻みは仮置き（本人未確認）。
import type { SetValue } from '@/lib/today-menu';
import { WELCOME_BACK_MIN_DAYS } from '@/lib/welcome-back';

export const REP_MAX = 12;
export const REP_MIN = 8;
export const WEIGHT_STEP_KG = 2.5;

// 休み明け（前回からのあいた日数が WELCOME_BACK_MIN_DAYS 以上）は、無理に進めず前回と同じ値を目標にする（A02-5。責めない）
export const isRestReturn = (daysSince: number | null | undefined): boolean => daysSince != null && daysSince >= WELCOME_BACK_MIN_DAYS;

export function suggestNext(last: SetValue, daysSince?: number | null): SetValue {
  if (isRestReturn(daysSince)) return { weightKg: last.weightKg, reps: last.reps };
  // 自重（0kg）は上げる重さが無いので、回数だけ増やす
  if (last.weightKg === 0) return { weightKg: 0, reps: last.reps + 1 };
  if (last.reps >= REP_MAX) return { weightKg: last.weightKg + WEIGHT_STEP_KG, reps: REP_MIN };
  return { weightKg: last.weightKg, reps: last.reps + 1 };
}
