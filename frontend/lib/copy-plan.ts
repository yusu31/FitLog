// メニューのコピー（F-24）で、仲間の記録から写した「やる予定」。画面をまたいで持つ（current-workout.ts と同じ作り）。
// ページを再読み込みすると消える。記録は「できた」を押したときに初めて作られる（コピーしただけでは7マスは埋まらない）
import type { SetValue } from '@/lib/shared/ghost';

export type CopyPlanItem = { exerciseId: string; name: string; sets: SetValue[] };
export type CopyPlan = {
  fromUserId: string;
  fromName: string | null;
  items: CopyPlanItem[];
  // 記録に copiedFromUserId を付けて送ったあとは true（以降の記録には付けない）
  used: boolean;
};

let plan: CopyPlan | null = null;

export const setCopyPlan = (next: Omit<CopyPlan, 'used'>): void => {
  plan = { ...next, used: false };
};
export const getCopyPlan = (): CopyPlan | null => plan;
export const markCopyPlanUsed = (): void => {
  if (plan) plan = { ...plan, used: true };
};
export const resetCopyPlan = (): void => {
  plan = null;
};

// 種目ごとの「やる予定」のセット（セット番号は1から振り直す）
export const planSetsFor = (p: CopyPlan | null, exerciseId: string): Array<SetValue & { setNo: number }> | undefined => {
  const item = p?.items.find((i) => i.exerciseId === exerciseId);
  return item && item.sets.length > 0 ? item.sets.map((s, i) => ({ setNo: i + 1, weightKg: s.weightKg, reps: s.reps })) : undefined;
};
