// 今日のメニューの組み立て（features.md UC-10。S-10 今日）。純粋な関数。
// 材料は「筋トレの記録の一覧（新しい順）」。今日の日付の記録は「今日やった分」、それより前で一番新しい記録が「前回」。
import type { RecordDetailResponse, RecordedExercise } from '@/lib/api/generated';
import { suggestNext } from '@/lib/menu-suggestion';
import { daysBetween } from '@/lib/welcome-back';

export type SetValue = { weightKg: number; reps: number };

export type MenuItem = {
  exerciseId: string;
  name: string;
  /** 前回の、今日これから入れるセットと同じ番号のセット（無ければ最後のセット）。前回の記録に無い種目（今日だけやった種目）は null */
  previous: SetValue | null;
  /** 今日の目標（F-23）。previous と同じセットから決める（前回と目標が別のセットの話にならないように。L12）。前回が無ければ null */
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
  /** つぎにやること＝まだできていない種目のうち、並びの先頭 */
  next: MenuItem | null;
  /** メニューがあり、全部できた。記録中（終わっていない）の間は false（「今日の分は できた」と言い切らない。N1） */
  allDone: boolean;
  /** いま記録中の筋トレ（サーバーの active。今日の日付のもの）。無ければ null。種目数・セット数は終了のまとめにも使う */
  session: { recordId: string; exerciseCount: number; setCount: number; lastExerciseId: string | null } | null;
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

  // 前回からのあいた日数（休み明けは前回と同じ値を目標にする。A02-5）
  const daysSince = previous ? daysBetween(previous.localDate, today) : null;

  const toItem = (exerciseId: string, name: string, same: SetValue | null): MenuItem => {
    const sets = todaySets.get(exerciseId)?.sets ?? [];
    return {
      exerciseId,
      name,
      previous: same,
      suggestion: same ? suggestNext(same, daysSince) : null,
      done: sets.length > 0,
      todayLast: sets.length > 0 ? valueOf(sets[sets.length - 1]) : null,
    };
  };

  // 「前回」は、今日これから入れるセットと同じ番号の前回のセット（記録画面の初期値と同じ基準。D3 L12）。
  // 今日まだ1つも入れていなければ1セット目。同じ番号が無ければ前回の最後のセット
  const items = (previous?.exercises ?? []).map((ex) => {
    const nextNo = (todaySets.get(ex.exerciseId)?.sets.length ?? 0) + 1;
    const same = ex.sets.find((s) => s.setNo === nextNo) ?? ex.sets[ex.sets.length - 1];
    return toItem(ex.exerciseId, ex.name, same ? valueOf(same) : null);
  });
  // 前回に無い種目を今日やったときは、末尾に足す
  for (const [exerciseId, { name }] of todaySets) {
    if (!items.some((i) => i.exerciseId === exerciseId)) items.push(toItem(exerciseId, name, null));
  }

  // 記録中の筋トレ（今日の日付だけ。同じ日に複数あれば、新しい順の先頭）
  const running = todays.find((r) => r.active === true);
  const session = running
    ? {
        recordId: running.id,
        exerciseCount: (running.exercises ?? []).length,
        setCount: (running.exercises ?? []).reduce((n, e) => n + e.sets.length, 0),
        // 「続ける」の行き先（D2-4）。記録中の筋トレで最後に入れた種目
        lastExerciseId: (running.exercises ?? []).at(-1)?.exerciseId ?? null,
      }
    : null;

  return {
    isFirstTime: previous === null,
    items,
    next: items.find((i) => !i.done) ?? null,
    allDone: session === null && items.length > 0 && items.every((i) => i.done),
    session,
  };
}
