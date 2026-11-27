import { and, eq, ne, sql } from 'drizzle-orm';
import type { DayAgg } from '../common/stats.js';
import { cellStatus } from '../common/week.js';
import type { Db } from '../db/db.module.js';
import { records, runDetails, workoutSets } from '../db/schema.js';

// ある人の記録を全期間から日ごとにまとめる（GET /stats と、足跡の達成チップが同じまとめ方を使う）。
// 投稿（post）は運動として数えない: 投稿だけの日を「記録のある日」にすると、自動の休みの判定や最初の記録の日がずれる
export async function loadDayAggs(db: Db, userId: string): Promise<DayAgg[]> {
  const kindRows = await db.select({ localDate: records.localDate, kind: records.kind }).from(records).where(and(eq(records.userId, userId), ne(records.kind, 'post')));
  const weightRows = await db
    .select({ localDate: records.localDate, total: sql<string>`sum(${workoutSets.weightKg} * ${workoutSets.reps})` })
    .from(workoutSets)
    .innerJoin(records, eq(records.id, workoutSets.recordId))
    .where(eq(records.userId, userId))
    .groupBy(records.localDate);
  const runRows = await db
    .select({ localDate: records.localDate, distanceM: runDetails.distanceM })
    .from(runDetails)
    .innerJoin(records, eq(records.id, runDetails.recordId))
    .where(eq(records.userId, userId));

  const days = new Map<string, DayAgg & { kinds: ('workout' | 'run' | 'rest' | 'post')[] }>();
  const dayOf = (date: string) => {
    let d = days.get(date);
    if (!d) days.set(date, (d = { date, status: 'none', weightKg: 0, runM: 0, maxRunM: 0, workoutCount: 0, runCount: 0, kinds: [] }));
    return d;
  };
  for (const r of kindRows) {
    const d = dayOf(r.localDate);
    d.kinds.push(r.kind);
    if (r.kind === 'workout') d.workoutCount += 1;
    if (r.kind === 'run') d.runCount += 1;
  }
  for (const r of weightRows) dayOf(r.localDate).weightKg = Number(r.total);
  for (const r of runRows) {
    const d = dayOf(r.localDate);
    d.runM += r.distanceM;
    d.maxRunM = Math.max(d.maxRunM, r.distanceM);
  }
  return [...days.values()].map((d) => ({ ...d, status: cellStatus(d.kinds) }));
}
