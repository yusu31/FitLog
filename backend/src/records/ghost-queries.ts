import { and, desc, eq, lt, or, sql } from 'drizzle-orm';
import type { Db } from '../db/db.module.js';
import { records, workoutSets } from '../db/schema.js';
import { volumeOf, type SetValue } from '../common/ghost.js';

// ゴースト（前回）と自己ベストの問い合わせ。GET /exercises/{id}/previous と POST /records/{id}/sets が共有する。
// 「前回」は同じ人・同じ種目の直近の記録で、before より前の recorded_at のものだけを見る。
// before を自分の記録の recorded_at にすると、再送しても前回が入れ替わらず、自分の記録が前回になることもない。

export type PreviousSets = { recordedAt: Date; sets: Array<SetValue & { setNo: number }> };
export type PersonalBest = SetValue & { volume: number };

// numeric 列は文字列で返ってくるので、数に直す
const toValue = (row: { setNo: number; weightKg: string; reps: number }) => ({ setNo: row.setNo, weightKg: Number(row.weightKg), reps: row.reps });

export async function findPrevious(db: Db, userId: string, exerciseId: string, before: Date | null): Promise<PreviousSets | null> {
  const [latest] = await db
    .select({ id: records.id, recordedAt: records.recordedAt })
    .from(records)
    .innerJoin(workoutSets, eq(workoutSets.recordId, records.id))
    .where(and(eq(records.userId, userId), eq(workoutSets.exerciseId, exerciseId), before ? lt(records.recordedAt, before) : undefined))
    .orderBy(desc(records.recordedAt), desc(records.id))
    .limit(1);
  if (!latest) return null;

  const rows = await db
    .select({ setNo: workoutSets.setNo, weightKg: workoutSets.weightKg, reps: workoutSets.reps })
    .from(workoutSets)
    .where(and(eq(workoutSets.recordId, latest.id), eq(workoutSets.exerciseId, exerciseId)))
    .orderBy(workoutSets.setNo);
  return { recordedAt: latest.recordedAt, sets: rows.map(toValue) };
}

// 過去最大の volume（重量×回数）のセット。同じ volume なら重い方、それも同じなら回数が多い方（毎回同じセットが選ばれるように）
export async function findPersonalBest(db: Db, userId: string, exerciseId: string, before: Date | null): Promise<PersonalBest | null> {
  const [best] = await db
    .select({ weightKg: workoutSets.weightKg, reps: workoutSets.reps })
    .from(workoutSets)
    .innerJoin(records, eq(records.id, workoutSets.recordId))
    .where(and(eq(records.userId, userId), eq(workoutSets.exerciseId, exerciseId), before ? lt(records.recordedAt, before) : undefined))
    .orderBy(sql`${workoutSets.weightKg} * ${workoutSets.reps} desc`, desc(workoutSets.weightKg), desc(workoutSets.reps))
    .limit(1);
  if (!best) return null;
  const value = { weightKg: Number(best.weightKg), reps: best.reps };
  return { ...value, volume: volumeOf(value) };
}

// あるセットより前に積まれた、同じ種目の過去最大の volume。「前」とは、
//  ・別の記録: recorded_at が自分の記録より前
//  ・同じ記録: セット番号が自分より小さい（2セット目は1セット目を含めて比べる。T-PB-06）
// 自分自身は含まないので、再送しても判定が変わらない（T-PB-05）
export async function pastMaxVolume(db: Db, userId: string, exerciseId: string, recordId: string, recordedAt: Date, setNo: number): Promise<number | null> {
  const [row] = await db
    .select({ max: sql<string | null>`max(${workoutSets.weightKg} * ${workoutSets.reps})` })
    .from(workoutSets)
    .innerJoin(records, eq(records.id, workoutSets.recordId))
    .where(
      and(
        eq(records.userId, userId),
        eq(workoutSets.exerciseId, exerciseId),
        or(lt(records.recordedAt, recordedAt), and(eq(workoutSets.recordId, recordId), lt(workoutSets.setNo, setNo))),
      ),
    );
  return row?.max == null ? null : Number(row.max);
}
