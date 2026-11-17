import type { routineSets } from '../db/schema.js';

type SourceSet = { exerciseId: string; setNo: number; weightKg: string; reps: number };

// 記録のセット（最初にセットを足した順に並べたもの）を、ルーティンの行にする（F3）。
// 種目の並び（position）は最初に出てきた順。セット番号は種目ごとに1から振り直す（途中のセットを消した記録でも 1,2,3… になる）
export function toRoutineSets(routineId: string, sets: SourceSet[]): Array<typeof routineSets.$inferInsert> {
  const perExercise = new Map<string, SourceSet[]>();
  for (const s of sets) perExercise.set(s.exerciseId, [...(perExercise.get(s.exerciseId) ?? []), s]);
  return [...perExercise.entries()].flatMap(([exerciseId, list], index) =>
    list
      .toSorted((a, b) => a.setNo - b.setNo)
      .map((s, i) => ({ routineId, exerciseId, position: index + 1, setNo: i + 1, weightKg: s.weightKg, reps: s.reps })),
  );
}
