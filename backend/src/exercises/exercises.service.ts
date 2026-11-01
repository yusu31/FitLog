import { BadRequestException, ConflictException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { and, asc, eq, isNull, or, sql } from 'drizzle-orm';
import { errorCode } from '../common/error-code.js';
import { DB, type Db } from '../db/db.module.js';
import { isUuid } from '../common/uuid.js';
import { exercises } from '../db/schema.js';
import { findPersonalBest, findPrevious } from '../records/ghost-queries.js';
import { parseIso } from '../records/record-input.js';
import { parseExerciseInput } from './exercise-input.js';
import type { ExerciseResponse, PreviousResponse } from './exercises.response.js';

const PG_UNIQUE_VIOLATION = '23505';

type Row = typeof exercises.$inferSelect;

// numeric 列は文字列で返ってくるので、数に直す（お試し値は一覧の種目だけ。無ければ null）
const toResponse = (row: Row): ExerciseResponse => ({
  id: row.id,
  name: row.name,
  bodyPart: row.bodyPart,
  isCustom: row.createdBy !== null,
  trialWeightKg: row.trialWeightKg === null ? null : Number(row.trialWeightKg),
  trialReps: row.trialReps,
});

@Injectable()
export class ExercisesService {
  private readonly logger = new Logger(ExercisesService.name);

  constructor(@Inject(DB) private readonly db: Db) {}

  // 一覧の種目＋自分が追加した種目。他の人が追加した種目は含めない。
  // 並び: 部位（enum の宣言順）→ 一覧の種目 → 自分の種目。一覧の種目は固定の ID の順（＝一覧の並び）、自分の種目は名前の順
  async list(userId: string): Promise<ExerciseResponse[]> {
    const rows = await this.db
      .select()
      .from(exercises)
      .where(or(isNull(exercises.createdBy), eq(exercises.createdBy, userId)))
      .orderBy(
        asc(exercises.bodyPart),
        sql`${exercises.createdBy} is not null`,
        sql`case when ${exercises.createdBy} is null then '' else ${exercises.name} end`,
        asc(exercises.id),
      );
    return rows.map(toResponse);
  }

  async add(userId: string, raw: unknown): Promise<ExerciseResponse> {
    const { name, bodyPart } = parseExerciseInput(raw);

    // 一覧の種目と同じ名前は、索引では止められない（別の行どうしを比べる必要がある）ので、ここで確かめる。大文字小文字は区別しない
    const [common] = await this.db
      .select({ id: exercises.id })
      .from(exercises)
      .where(and(isNull(exercises.createdBy), sql`lower(${exercises.name}) = lower(${name})`))
      .limit(1);
    if (common) throw this.alreadyExists();

    try {
      const [created] = await this.db.insert(exercises).values({ name, bodyPart, createdBy: userId }).returning();
      this.logger.log(`自分用の種目を追加: ${created.id}`);
      return toResponse(created);
    } catch (err) {
      // 自分の同名は (created_by, lower(name)) の一意索引が止める。同時に2回送られても、事前の確認をすり抜けた1件がここで止まる
      if (errorCode(err) === PG_UNIQUE_VIOLATION) throw this.alreadyExists();
      throw err;
    }
  }

  // 前回（同じ種目の直近の記録）と自己ベストを返す（ゴースト・F-05・F-06）。before を付けると、その時刻より前の記録だけを見る
  // （記録中の自分の記録が「前回」にならないように、画面は今の記録の時刻を渡す）。一覧の種目か自分の種目だけが見える
  async previous(userId: string, exerciseId: string, beforeRaw: unknown): Promise<PreviousResponse> {
    let before: Date | null = null;
    if (beforeRaw !== undefined) {
      const at = typeof beforeRaw === 'string' ? parseIso(beforeRaw) : undefined;
      if (!at) {
        throw new BadRequestException({ code: 'VALIDATION_ERROR', message: '入力が正しくありません', details: ['before: ISO 8601 の日時（例: 2026-11-01T09:00:00Z）で指定してください'] });
      }
      before = at;
    }

    const notFound = () => new NotFoundException({ code: 'EXERCISE_NOT_FOUND', message: '種目が見つかりません', details: null });
    if (!isUuid(exerciseId)) throw notFound();
    const id = exerciseId.toLowerCase();
    const [exercise] = await this.db
      .select({ id: exercises.id })
      .from(exercises)
      .where(and(eq(exercises.id, id), or(isNull(exercises.createdBy), eq(exercises.createdBy, userId))));
    if (!exercise) throw notFound();

    const [previous, personalBest] = await Promise.all([findPrevious(this.db, userId, id, before), findPersonalBest(this.db, userId, id, before)]);
    return { previous: previous && { recordedAt: previous.recordedAt.toISOString(), sets: previous.sets }, personalBest };
  }

  private alreadyExists() {
    return new ConflictException({ code: 'EXERCISE_ALREADY_EXISTS', message: '同じ名前の種目がすでにあります', details: null });
  }
}
