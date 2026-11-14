// 今日のメニューの組み立て（features.md UC-10。S-10 今日）。純粋な関数。
// 材料は「筋トレの記録の一覧（新しい順）」。今日の日付の記録は「今日やった分」、それより前で一番新しい記録が「前回」。
import type { RecordDetailResponse, RecordedExercise } from '@/lib/api/generated';
import { suggestNext } from '@/lib/menu-suggestion';

export type SetValue = { weightKg: number; reps: number };

export type MenuItem = {
  exerciseId: string;
  name: string;
  /** 前回の1セット目。前回の記録に無い種目（今日だけやった種目）は null */
  previous: SetValue | null;
  /** 今日の目標（F-23）。前回の最後のセットから決める。前回が無ければ null */
  suggestion: SetValue | null;
  /** 今日、その種目にセットが1つでも入っていれば true */
  done: boolean;
  /** 今日入れた最後のセット */
  todayLast: SetValue | null;
};

export type TodayMenu = {
  /** 前回の筋トレが無い（初回） */
  isFirstTime: boolean;
  items: MenuItem[];
  /** 次の1枚＝まだできていない種目のうち、並びの先頭 */
  next: MenuItem | null;
  /** メニューがあり、全部できた */
  allDone: boolean;
};

const valueOf = (s: { weightKg: number; reps: number }): SetValue => ({ weightKg: s.weightKg, reps: s.reps });

export function buildMenu(workouts: readonly RecordDetailResponse[], today: string): TodayMenu {
  const mine = workouts.filter((r) => r.kind === 'workout');
  const todays = mine.filter((r) => r.localDate === today);
  const previous = mine.find((r) => r.localDate < today) ?? null;

  // 同じ日に筋トレが2件あっても、種目ごとに今日のセットをまとめる
  const todaySets = new Map<string, { name: string; sets: RecordedExercise['sets'] }>();
  for (const record of todays) {
    for (const ex of record.exercises ?? []) {
      const entry = todaySets.get(ex.exerciseId) ?? { name: ex.name, sets: [] };
      entry.sets = [...entry.sets, ...ex.sets];
      todaySets.set(ex.exerciseId, entry);
    }
  }

  const toItem = (exerciseId: string, name: string, first: SetValue | null, last: SetValue | null): MenuItem => {
    const sets = todaySets.get(exerciseId)?.sets ?? [];
    return {
      exerciseId,
      name,
      previous: first,
      suggestion: last ? suggestNext(last) : null,
      done: sets.length > 0,
      todayLast: sets.length > 0 ? valueOf(sets[sets.length - 1]) : null,
    };
  };

  const items = (previous?.exercises ?? []).map((ex) =>
    toItem(ex.exerciseId, ex.name, ex.sets[0] ? valueOf(ex.sets[0]) : null, ex.sets.length > 0 ? valueOf(ex.sets[ex.sets.length - 1]) : null),
  );
  // 前回に無い種目を今日やったときは、末尾に足す
  for (const [exerciseId, { name }] of todaySets) {
    if (!items.some((i) => i.exerciseId === exerciseId)) items.push(toItem(exerciseId, name, null, null));
  }

  return {
    isFirstTime: previous === null,
    items,
    next: items.find((i) => !i.done) ?? null,
    allDone: items.length > 0 && items.every((i) => i.done),
  };
}
