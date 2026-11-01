import { ConflictException, Inject, Injectable, Logger } from '@nestjs/common';
import { and, asc, eq, isNull, or, sql } from 'drizzle-orm';
import { errorCode } from '../common/error-code.js';
import { DB, type Db } from '../db/db.module.js';
import { exercises } from '../db/schema.js';
import { parseExerciseInput } from './exercise-input.js';
import type { ExerciseResponse } from './exercises.response.js';

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

  private alreadyExists() {
    return new ConflictException({ code: 'EXERCISE_ALREADY_EXISTS', message: '同じ名前の種目がすでにあります', details: null });
  }
}
