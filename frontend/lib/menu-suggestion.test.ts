import { describe, expect, it } from 'vitest';
import { REP_MAX, REP_MIN, WEIGHT_STEP_KG, suggestNext } from './menu-suggestion';

// T-SUGGEST: 前回の最後のセット → 今日の目標（F-23）。上限・下限・刻みは仮置き（本人未確認）
describe('suggestNext', () => {
  it('上限より下なら、同じ重さで回数を1回増やす', () => {
    expect(suggestNext({ weightKg: 60, reps: 10 })).toEqual({ weightKg: 60, reps: 11 });
  });

  it('上限の1つ手前（境界）は上限まで増やし、重さは変えない', () => {
    expect(suggestNext({ weightKg: 60, reps: REP_MAX - 1 })).toEqual({ weightKg: 60, reps: REP_MAX });
  });

  it('上限ちょうどなら、重さを上げて回数を下限に戻す', () => {
    expect(suggestNext({ weightKg: 60, reps: REP_MAX })).toEqual({ weightKg: 60 + WEIGHT_STEP_KG, reps: REP_MIN });
  });

  it('上限を超えていても、重さを上げて回数を下限に戻す', () => {
    expect(suggestNext({ weightKg: 40, reps: REP_MAX + 5 })).toEqual({ weightKg: 40 + WEIGHT_STEP_KG, reps: REP_MIN });
  });

  it('下限より少ない回数でも、回数を1回増やす（重さは上げない）', () => {
    expect(suggestNext({ weightKg: 80, reps: 3 })).toEqual({ weightKg: 80, reps: 4 });
  });

  it('自重（0kg）は重さを上げず、回数だけ増やす（上限でも増やす）', () => {
    expect(suggestNext({ weightKg: 0, reps: 15 })).toEqual({ weightKg: 0, reps: 16 });
  });
});
