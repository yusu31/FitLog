import { ConflictException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { and, asc, count, eq, inArray } from 'drizzle-orm';
import { errorCode } from '../common/error-code.js';
import { isUuid } from '../common/uuid.js';
import { DB, type Db } from '../db/db.module.js';
import { exercises, records, ROUTINE_MAX, routines, routineSets, users, workoutSets } from '../db/schema.js';
import { parseRoutineInput } from './routine-input.js';
import { toRoutineSets } from './routine-sets.js';
import type { RoutineExercise, RoutineListResponse, RoutineResponse } from './routines.response.js';

const PG_UNIQUE_VIOLATION = '23505';

const recordNotFound = () => new NotFoundException({ code: 'RECORD_NOT_FOUND', message: '記録が見つかりません', details: null });
const routineNotFound = () => new NotFoundException({ code: 'ROUTINE_NOT_FOUND', message: 'ルーティンが見つかりません', details: null });

// ルーティン（F3。docs/design.md 4章）。自分の筋トレの記録1件から、種目と回数・重さを写して保存する。見えるのは自分のものだけ
@Injectable()
export class RoutinesService {
  private readonly logger = new Logger(RoutinesService.name);

  constructor(@Inject(DB) private readonly db: Db) {}

  async list(userId: string): Promise<RoutineListResponse> {
    const rows = await this.db
      .select({ id: routines.id, name: routines.name, createdAt: routines.createdAt })
      .from(routines)
      .where(eq(routines.userId, userId))
      .orderBy(asc(routines.createdAt), asc(routines.id));
    return { items: await this.withExercises(rows), max: ROUTINE_MAX };
  }

  // 保存する。上限（5件）を数える前に、持ち主の users の行を FOR UPDATE でロックする（groups の参加と同じ形）。
  // ロックしないと、READ COMMITTED では同時に2回押したとき両方が「4件」と数え、6件になる。
  // 同じ名前は routines_user_name_uq が止める（一意の違反はトランザクションを壊すので、外で受けて 409 にする）。
  // トランザクションの中では tx だけを使う（接続は1本なので、中で this.db を使うと自分の接続の空きを待って止まる）
  async create(userId: string, raw: unknown): Promise<RoutineResponse> {
    const input = parseRoutineInput(raw);
    let created: { id: string; name: string; createdAt: Date };
    try {
      created = await this.db.transaction(async (tx) => {
        await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for('update');

        const [record] = await tx.select({ userId: records.userId, kind: records.kind }).from(records).where(eq(records.id, input.recordId));
        if (!record || record.userId !== userId) throw recordNotFound();
        if (record.kind !== 'workout') {
          throw new ConflictException({ code: 'RECORD_KIND_MISMATCH', message: '筋トレの記録だけをルーティンにできます', details: null });
        }

        const sets = await tx
          .select({ exerciseId: workoutSets.exerciseId, setNo: workoutSets.setNo, weightKg: workoutSets.weightKg, reps: workoutSets.reps })
          .from(workoutSets)
          .where(eq(workoutSets.recordId, input.recordId))
          .orderBy(asc(workoutSets.createdAt), asc(workoutSets.setNo), asc(workoutSets.id));
        if (sets.length === 0) {
          throw new ConflictException({ code: 'ROUTINE_EMPTY', message: 'セットの無い記録はルーティンにできません', details: null });
        }

        const [{ n }] = await tx.select({ n: count() }).from(routines).where(eq(routines.userId, userId));
        if (n >= ROUTINE_MAX) {
          throw new ConflictException({ code: 'ROUTINE_LIMIT', message: `ルーティンは${ROUTINE_MAX}つまでです。使わないものを消してください`, details: null });
        }

        const [routine] = await tx
          .insert(routines)
          .values({ userId, name: input.name })
          .returning({ id: routines.id, name: routines.name, createdAt: routines.createdAt });
        await tx.insert(routineSets).values(toRoutineSets(routine.id, sets));
        return routine;
      });
    } catch (err) {
      if (errorCode(err) === PG_UNIQUE_VIOLATION) {
        throw new ConflictException({ code: 'ROUTINE_NAME_TAKEN', message: '同じ名前のルーティンがあります', details: null });
      }
      throw err;
    }
    this.logger.log(`ルーティンを保存: ${created.id}`);
    const [response] = await this.withExercises([created]);
    return response;
  }

  async remove(userId: string, routineId: string): Promise<void> {
    if (!isUuid(routineId)) throw routineNotFound();
    const removed = await this.db
      .delete(routines)
      .where(and(eq(routines.id, routineId.toLowerCase()), eq(routines.userId, userId)))
      .returning({ id: routines.id });
    if (removed.length === 0) throw routineNotFound();
    this.logger.log(`ルーティンを消した: ${removed[0].id}`);
  }

  private async withExercises(rows: Array<{ id: string; name: string; createdAt: Date }>): Promise<RoutineResponse[]> {
    if (rows.length === 0) return [];
    const setRows = await this.db
      .select({
        routineId: routineSets.routineId,
        exerciseId: routineSets.exerciseId,
        name: exercises.name,
        bodyPart: exercises.bodyPart,
        setNo: routineSets.setNo,
        weightKg: routineSets.weightKg,
        reps: routineSets.reps,
      })
      .from(routineSets)
      .innerJoin(exercises, eq(exercises.id, routineSets.exerciseId))
      .where(
        inArray(
          routineSets.routineId,
          rows.map((r) => r.id),
        ),
      )
      .orderBy(asc(routineSets.position), asc(routineSets.setNo));

    const byRoutine = new Map<string, Map<string, RoutineExercise>>();
    for (const s of setRows) {
      const perRoutine = byRoutine.get(s.routineId) ?? new Map<string, RoutineExercise>();
      byRoutine.set(s.routineId, perRoutine);
      const entry = perRoutine.get(s.exerciseId) ?? { exerciseId: s.exerciseId, name: s.name, bodyPart: s.bodyPart, sets: [] };
      perRoutine.set(s.exerciseId, entry);
      entry.sets.push({ setNo: s.setNo, weightKg: Number(s.weightKg), reps: s.reps });
    }
    return rows.map((r) => ({ id: r.id, name: r.name, createdAt: r.createdAt.toISOString(), exercises: [...(byRoutine.get(r.id)?.values() ?? [])] }));
  }
}
