import { ConflictException, ForbiddenException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { isUuid } from '../common/uuid.js';
import { DB, type Db } from '../db/db.module.js';
import { comments, reactions, records, users } from '../db/schema.js';
import { findVisibleRecord, visibleToMe } from '../records/record-access.js';
import { parseCommentInput, parseReactionInput } from './feed-input.js';
import type { CommentResponse, ReactionResponse } from './feed.response.js';
import { stampFitsKind } from './stamps.js';

// スタンプとコメント（F-10。docs/design.md 3章）。
// どの操作も、先に「その記録を見られるか」を record-access.ts の共通の関数で確かめる。
// 無い・別のグループの人の・グループに入っていない人から見た他人の記録は、どれも同じ 404 RECORD_NOT_FOUND（存在を教えない）

const recordNotFound = () => new NotFoundException({ code: 'RECORD_NOT_FOUND', message: '記録が見つかりません', details: null });
const reactionNotFound = () => new NotFoundException({ code: 'REACTION_NOT_FOUND', message: 'スタンプが見つかりません', details: null });
const commentNotFound = () => new NotFoundException({ code: 'COMMENT_NOT_FOUND', message: 'コメントが見つかりません', details: null });

@Injectable()
export class SocialService {
  private readonly logger = new Logger(SocialService.name);

  constructor(@Inject(DB) private readonly db: Db) {}

  // スタンプを付ける。冪等。created=true なら新しく付けた（201）、false ならすでにあるものを返した（200）。
  // 確かめる順番: 入力（400）→ 記録を見られるか（404）→ 記録の種類にそのスタンプを付けられるか（409）→ 追加。
  //  ・同じ id が自分のスタンプにある → 1回目の内容を返す
  //  ・同じ id が他の人のスタンプにある → 404（存在を教えない）
  //  ・同じ人が同じ記録に同じスタンプを別の id で付けた → 付いているスタンプを返す（1件のまま。T-STP-01）
  async addReaction(userId: string, recordId: string, raw: unknown): Promise<{ created: boolean; reaction: ReactionResponse }> {
    const input = parseReactionInput(raw);
    const record = await findVisibleRecord(this.db, userId, recordId);
    if (!record) throw recordNotFound();
    if (!stampFitsKind(input.stampKey, record.kind)) {
      throw new ConflictException({
        code: 'RECORD_KIND_MISMATCH',
        message: record.kind === 'rest' ? '休みの記録には休み用のスタンプだけ付けられます' : '休み用のスタンプは休みの記録にだけ付けられます',
        details: null,
      });
    }

    // 対象を決めない ON CONFLICT DO NOTHING は、id の衝突も、(記録・人・スタンプ) の一意の衝突も「何もしない」にする。
    // 何もしなかったあとに、どちらだったかを読み直す（記録・セットの作成と同じ形）
    const [inserted] = await this.db.insert(reactions).values({ id: input.id, recordId: record.id, userId, stampKey: input.stampKey }).onConflictDoNothing().returning();
    if (inserted) {
      this.logger.log(`スタンプを付けた: ${inserted.id}`);
      return { created: true, reaction: toReaction(inserted) };
    }

    const [sameId] = await this.db.select().from(reactions).where(eq(reactions.id, input.id));
    if (sameId) {
      // 他の人のスタンプ・別の記録のスタンプと同じ id を送ってきた
      if (sameId.userId !== userId || sameId.recordId !== record.id) throw reactionNotFound();
      return { created: false, reaction: toReaction(sameId) };
    }
    const [sameStamp] = await this.db
      .select()
      .from(reactions)
      .where(and(eq(reactions.recordId, record.id), eq(reactions.userId, userId), eq(reactions.stampKey, input.stampKey)));
    if (sameStamp) return { created: false, reaction: toReaction(sameStamp) };
    // 何もしなかったのに、どちらの行も見つからない（間に外された）。起きない想定なので 500 にして気づけるようにする
    throw new Error('スタンプの追加が衝突したのに、衝突相手が見つかりません');
  }

  // 自分のスタンプを外す。確かめる順番: 記録を見られるか（404）→ その記録のスタンプか（404）→ 自分のか（403）。
  // 二重に外すと 2 回目は 404（消えた行の持ち主は分からない。design.md 7章）
  async deleteReaction(userId: string, recordId: string, reactionId: string): Promise<void> {
    const record = await findVisibleRecord(this.db, userId, recordId);
    if (!record) throw recordNotFound();
    if (!isUuid(reactionId)) throw reactionNotFound();

    const [row] = await this.db
      .select({ userId: reactions.userId })
      .from(reactions)
      .where(and(eq(reactions.id, reactionId.toLowerCase()), eq(reactions.recordId, record.id)));
    if (!row) throw reactionNotFound();
    if (row.userId !== userId) throw new ForbiddenException({ code: 'FORBIDDEN', message: '他の人のスタンプは外せません', details: null });

    // 持ち主の確認と削除を1つの文で行う
    const deleted = await this.db
      .delete(reactions)
      .where(and(eq(reactions.id, reactionId.toLowerCase()), eq(reactions.userId, userId)))
      .returning({ id: reactions.id });
    if (deleted.length === 0) throw reactionNotFound();
    this.logger.log(`スタンプを外した: ${deleted[0].id}`);
  }

  // コメントを付ける。冪等。created=true なら新しく付けた（201）、false ならすでにあるものを返した（200）。
  //  ・同じ id が自分のコメントにある → 1回目の内容を返す（2回目の本文は捨てる）
  //  ・同じ id が他の人のコメント・別の記録のコメントにある → 404
  async addComment(userId: string, recordId: string, raw: unknown): Promise<{ created: boolean; comment: CommentResponse }> {
    const input = parseCommentInput(raw);
    const record = await findVisibleRecord(this.db, userId, recordId);
    if (!record) throw recordNotFound();

    const [inserted] = await this.db.insert(comments).values({ id: input.id, recordId: record.id, userId, body: input.body }).onConflictDoNothing().returning();
    if (inserted) {
      this.logger.log(`コメントを付けた: ${inserted.id}`);
      return { created: true, comment: await this.toComment(inserted) };
    }

    const [sameId] = await this.db.select().from(comments).where(eq(comments.id, input.id));
    if (!sameId || sameId.userId !== userId || sameId.recordId !== record.id) {
      // 何もしなかったのに行が無い（間に消された）なら 404 にしておく。他の人のコメントと同じ id のときも 404（存在を教えない）
      throw commentNotFound();
    }
    return { created: false, comment: await this.toComment(sameId) };
  }

  // 自分のコメントを消す。確かめる順番: コメントがあり、その記録を見られるか（404。無い・別のグループの記録のコメントは同じ 404）→ 自分のか（403）。
  // 二重に消すと 2 回目は 404
  async deleteComment(userId: string, commentId: string): Promise<void> {
    if (!isUuid(commentId)) throw commentNotFound();
    const [row] = await this.db
      .select({ userId: comments.userId })
      .from(comments)
      .innerJoin(records, eq(records.id, comments.recordId))
      .where(and(eq(comments.id, commentId.toLowerCase()), visibleToMe(this.db, userId)));
    if (!row) throw commentNotFound();
    if (row.userId !== userId) throw new ForbiddenException({ code: 'FORBIDDEN', message: '他の人のコメントは消せません', details: null });

    const deleted = await this.db
      .delete(comments)
      .where(and(eq(comments.id, commentId.toLowerCase()), eq(comments.userId, userId)))
      .returning({ id: comments.id });
    if (deleted.length === 0) throw commentNotFound();
    this.logger.log(`コメントを消した: ${deleted[0].id}`);
  }

  private async toComment(row: typeof comments.$inferSelect): Promise<CommentResponse> {
    const [author] = await this.db.select({ id: users.id, name: users.name, avatar: users.avatar }).from(users).where(eq(users.id, row.userId));
    return {
      id: row.id,
      recordId: row.recordId,
      body: row.body,
      createdAt: row.createdAt.toISOString(),
      author: author as CommentResponse['author'],
    };
  }
}

const toReaction = (row: typeof reactions.$inferSelect): ReactionResponse => ({ id: row.id, recordId: row.recordId, stampKey: row.stampKey as ReactionResponse['stampKey'] });
