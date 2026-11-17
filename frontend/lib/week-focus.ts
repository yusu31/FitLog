import { addDays, weekStartOf } from '@/lib/shared/week';

type KindDay = { kind: 'workout' | 'run' | 'rest'; localDate: string };

// 今週（月〜日・日本時間）のラン件数が筋トレ件数より多い人か（N9）。同数・どちらも0は false（今の並びのまま）。
// 自分タブの「今週のラン」を筋肉の図の上へ出すかどうかの判定。休みは数えない
export function isRunHeavyWeek(records: readonly KindDay[], today: string): boolean {
  const start = weekStartOf(today);
  const end = addDays(start, 6);
  const inWeek = records.filter((r) => r.localDate >= start && r.localDate <= end);
  const runs = inWeek.filter((r) => r.kind === 'run').length;
  const workouts = inWeek.filter((r) => r.kind === 'workout').length;
  return runs > workouts;
}
