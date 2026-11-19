import { Inject, Injectable } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import { DB, type Db } from '../db/db.module.js';
import { exercises, records, runDetails, workoutSets } from '../db/schema.js';
import { type CsvValue, toCsv } from './csv.js';

const KIND_LABEL = { workout: '筋トレ', run: 'ラン', rest: '休み' } as const;
const BODY_PART_LABEL = { chest: '胸', back: '背中', shoulders: '肩', arms: '腕', abs: '腹', glutes: '尻', legs: '脚' } as const;

export const EXPORT_HEADER = ['日付', '種類', '種目', '部位', 'セット', '重さ(kg)', '回数', '距離(m)', '時間(秒)', 'きつさ(1-10)', 'メモ'];

@Injectable()
export class ExportService {
  constructor(@Inject(DB) private readonly db: Db) {}

  // 自分の記録だけを、1行1セット（ランは1行1回・休みは1行）で返す。userId で必ず絞る
  async exportCsv(userId: string): Promise<string> {
    const rows = await this.db
      .select({
        localDate: records.localDate,
        kind: records.kind,
        exerciseName: exercises.name,
        bodyPart: exercises.bodyPart,
        setNo: workoutSets.setNo,
        weightKg: workoutSets.weightKg,
        reps: workoutSets.reps,
        distanceM: runDetails.distanceM,
        durationS: runDetails.durationS,
        rpe: records.rpe,
        note: records.note,
      })
      .from(records)
      .leftJoin(workoutSets, eq(workoutSets.recordId, records.id))
      .leftJoin(exercises, eq(exercises.id, workoutSets.exerciseId))
      .leftJoin(runDetails, eq(runDetails.recordId, records.id))
      .where(eq(records.userId, userId))
      .orderBy(asc(records.recordedAt), asc(records.id), asc(workoutSets.createdAt), asc(workoutSets.setNo));

    const body: CsvValue[][] = rows.map((r) => [
      r.localDate,
      KIND_LABEL[r.kind],
      r.exerciseName,
      r.bodyPart ? BODY_PART_LABEL[r.bodyPart] : null,
      r.setNo,
      r.weightKg === null ? null : Number(r.weightKg),
      r.reps,
      r.distanceM,
      r.durationS,
      r.rpe,
      r.note,
    ]);
    return toCsv(EXPORT_HEADER, body);
  }
}
