import { ConflictException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { and, eq, isNull, or } from 'drizzle-orm';
import { toLocalDate } from '../common/local-date.js';
import { isUuid } from '../common/uuid.js';
import { DB, type Db } from '../db/db.module.js';
import { exercises, records, workoutSets } from '../db/schema.js';
import { parseRecordInput } from './record-input.js';
import type { RecordResponse, SetResponse } from './records.response.js';
import { parseSetInput } from './set-input.js';

type Row = typeof records.$inferSelect;

const toResponse = (row: Row): RecordResponse => ({
  id: row.id,
  kind: row.kind,
  recordedAt: row.recordedAt.toISOString(),
  localDate: row.localDate,
});

// numeric 列は文字列で返ってくるので、数に直す
const toSetResponse = (row: typeof workoutSets.$inferSelect): SetResponse => ({
  id: row.id,
  setNo: row.setNo,
  weightKg: Number(row.weightKg),
  reps: row.reps,
});

const recordNotFound = () => new NotFoundException({ code: 'RECORD_NOT_FOUND', message: '記録が見つかりません', details: null });

@Injectable()
export class RecordsService {
  private readonly logger = new Logger(RecordsService.name);

  constructor(@Inject(DB) private readonly db: Db) {}

  // 記録を作る。冪等（同じリクエストを2回送っても結果が1回分と同じ。F-30 の再送のため）。
  // created=true なら新しく作った（201）。false なら、すでにある記録を返した（200）:
  //  ・同じ id が自分の記録にある → 1回目の内容をそのまま返す（2回目の中身は捨てる。T-OFF-03）
  //  ・同じ id が他の人の記録にある → 404（存在を教えない。T-OFF-04）
  //  ・休みを、同じ日に別の id で送った → すでにある休みを返す（休みは1日1件）
  async create(userId: string, raw: unknown): Promise<{ created: boolean; record: RecordResponse }> {
    const { id, kind, recordedAt } = parseRecordInput(raw);
    const localDate = toLocalDate(recordedAt);

    // ON CONFLICT DO NOTHING（対象を決めない）は、主キー（id）の衝突も、休みの部分一意索引の衝突も、エラーにせず「何もしない」にする。
    // 同時に2つ届いても、後から来た方は先の方の確定を待って「何もしない」になるので、どちらも成功する（T-OFF-06・T-REST-06）
    const [inserted] = await this.db.insert(records).values({ id, userId, kind, recordedAt, localDate }).onConflictDoNothing().returning();
    if (inserted) {
      this.logger.log(`記録を作成: ${inserted.id}（${kind}）`);
      return { created: true, record: toResponse(inserted) };
    }

    const [sameId] = await this.db.select().from(records).where(eq(records.id, id));
    if (sameId) {
      if (sameId.userId !== userId) throw new NotFoundException({ code: 'RECORD_NOT_FOUND', message: '記録が見つかりません', details: null });
      return { created: false, record: toResponse(sameId) };
    }

    const [sameDayRest] = await this.db
      .select()
      .from(records)
      .where(and(eq(records.userId, userId), eq(records.localDate, localDate), eq(records.kind, 'rest')));
    if (sameDayRest) return { created: false, record: toResponse(sameDayRest) };

    // 何もしなかったのに、どちらの行も見つからない（間に消された）。起きない想定なので 500 にして気づけるようにする
    throw new Error('記録の作成が衝突したのに、衝突相手が見つかりません');
  }

  // 筋トレのセットを足す。冪等（再送しても二重にならない）。created=true なら新しく作った（201）、false ならすでにあるセットを返した（200）。
  // 確かめる順番: 入力（400）→ 記録が自分のものか（404。他人の記録も同じ。存在を教えない）→ 記録が筋トレか（409）→ 種目が見えるか（404）→ 追加。
  //  ・同じ id が自分のセットにある → 1回目の内容をそのまま返す（2回目の中身は捨てる。T-OFF-03）
  //  ・同じ id が他の人のセットにある → 404（T-OFF-14）
  //  ・同じ記録・同じ種目・同じセット番号を別の id で送った → 409 SET_NUMBER_TAKEN（T-SET-14）
  async addSet(userId: string, recordId: string, raw: unknown): Promise<{ created: boolean; set: SetResponse }> {
    const input = parseSetInput(raw);
    if (!isUuid(recordId)) throw recordNotFound();

    const [record] = await this.db.select({ userId: records.userId, kind: records.kind }).from(records).where(eq(records.id, recordId.toLowerCase()));
    if (!record || record.userId !== userId) throw recordNotFound();
    if (record.kind !== 'workout') {
      throw new ConflictException({ code: 'RECORD_KIND_MISMATCH', message: '筋トレの記録にだけセットを足せます', details: null });
    }

    // 一覧の種目か、自分で追加した種目だけが見える（他の人が追加した種目の id は「無い」と同じ）
    const [exercise] = await this.db
      .select({ id: exercises.id })
      .from(exercises)
      .where(and(eq(exercises.id, input.exerciseId), or(isNull(exercises.createdBy), eq(exercises.createdBy, userId))));
    if (!exercise) throw new NotFoundException({ code: 'EXERCISE_NOT_FOUND', message: '種目が見つかりません', details: null });

    // 対象を決めない ON CONFLICT DO NOTHING は、id の衝突も、(記録・種目・セット番号) の一意の衝突も「何もしない」にする。
    // 何もしなかったあとに、どちらだったかを読み直して分ける（記録の作成と同じ形）
    const [inserted] = await this.db
      .insert(workoutSets)
      .values({ id: input.id, recordId: recordId.toLowerCase(), exerciseId: input.exerciseId, setNo: input.setNo, weightKg: String(input.weightKg), reps: input.reps })
      .onConflictDoNothing()
      .returning();
    if (inserted) {
      this.logger.log(`セットを追加: ${inserted.id}`);
      return { created: true, set: toSetResponse(inserted) };
    }

    const [existing] = await this.db
      .select({ set: workoutSets, ownerId: records.userId })
      .from(workoutSets)
      .innerJoin(records, eq(records.id, workoutSets.recordId))
      .where(eq(workoutSets.id, input.id));
    if (existing) {
      if (existing.ownerId !== userId) throw new NotFoundException({ code: 'SET_NOT_FOUND', message: 'セットが見つかりません', details: null });
      return { created: false, set: toSetResponse(existing.set) };
    }
    throw new ConflictException({ code: 'SET_NUMBER_TAKEN', message: 'そのセット番号はすでに使われています', details: null });
  }
}
