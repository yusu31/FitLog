import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { toLocalDate } from '../common/local-date.js';
import { DB, type Db } from '../db/db.module.js';
import { records } from '../db/schema.js';
import { parseRecordInput } from './record-input.js';
import type { RecordResponse } from './records.response.js';

type Row = typeof records.$inferSelect;

const toResponse = (row: Row): RecordResponse => ({
  id: row.id,
  kind: row.kind,
  recordedAt: row.recordedAt.toISOString(),
  localDate: row.localDate,
});

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
}
