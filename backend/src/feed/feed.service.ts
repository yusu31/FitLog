import { Inject, Injectable } from '@nestjs/common';
import { and, asc, between, count, desc, eq, gt, inArray, lt, ne, or, sql } from 'drizzle-orm';
import { weekDates } from '../common/week.js';
import { DB, type Db } from '../db/db.module.js';
import { comments, exercises, reactions, records, runDetails, users, videos, workoutSets } from '../db/schema.js';
import { encodeCursor } from '../records/list-input.js';
import { ownerInMyGroup } from '../records/record-access.js';
import { FEED_PAGE_SIZE, parseFeedQuery } from './feed-input.js';
import type { FeedItem, FeedResponse, FeedStamp, FeedTotals, FeedUnreadResponse } from './feed.response.js';
import { summarizeStamps } from './stamps.js';

// 仲間の足跡と週の合計（F-09。docs/design.md 3章 GET /feed・6章）。

// 足跡と合計が取る記録の範囲を決める、この API で唯一の関数。
// 「同じグループの人の記録」（record-access.ts の ownerInMyGroup。グループに入っていなければ何も当たらない）と、
// 「その週（月曜〜日曜の local_date）」を必ず一緒に付ける。足跡の一覧も、合計の3本の集計も、ここを通す
export function feedScope(db: Db, userId: string, weekStart: string) {
  const dates = weekDates(weekStart);
  return and(ownerInMyGroup(db, userId), between(records.localDate, dates[0], dates[6]));
}

@Injectable()
export class FeedService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async feed(userId: string, rawQuery: { weekStart?: unknown; cursor?: unknown }): Promise<FeedResponse> {
    const { weekStart, cursor } = parseFeedQuery(rawQuery);
    const scope = feedScope(this.db, userId, weekStart);

    // 運動した時刻の降順、同じ時刻は id の降順。cursor は「最後に読んだ1件」の（時刻, id）。
    // limit+1 件読み、余った1件があれば続きがある（ちょうど割り切れるときに空のページを返さない）
    const rows = await this.db
      .select({ record: records, authorId: users.id, authorName: users.name, authorAvatar: users.avatar })
      .from(records)
      .innerJoin(users, eq(users.id, records.userId))
      .where(
        and(
          scope,
          cursor ? or(lt(records.recordedAt, cursor.recordedAt), and(eq(records.recordedAt, cursor.recordedAt), lt(records.id, cursor.id))) : undefined,
        ),
      )
      .orderBy(desc(records.recordedAt), desc(records.id))
      .limit(FEED_PAGE_SIZE + 1);

    const page = rows.slice(0, FEED_PAGE_SIZE);
    const last = page[page.length - 1];
    const ids = page.map((r) => r.record.id);

    const seenAt = await this.watermark(userId);
    const [exerciseNames, runs, stamps, commentCounts, totals, reactedMine, withVideo] = await Promise.all([
      this.exerciseNamesOf(ids),
      this.runsOf(ids),
      this.stampsOf(ids, userId),
      this.commentCountsOf(ids),
      this.totals(scope),
      this.myRecordsWithNewReactions(userId, seenAt, ids),
      this.recordsWithVideo(ids),
    ]);
    const isNew = (record: (typeof page)[number]['record'], authorId: string) =>
      authorId === userId ? reactedMine.has(record.id) : record.createdAt > seenAt;

    const items: FeedItem[] = page.map(({ record, authorId, authorName, authorAvatar }) => ({
      id: record.id,
      kind: record.kind,
      recordedAt: record.recordedAt.toISOString(),
      localDate: record.localDate,
      ...(record.late ? { late: true } : {}),
      author: { id: authorId, name: authorName, avatar: authorAvatar as FeedItem['author']['avatar'] },
      exerciseNames: exerciseNames.get(record.id) ?? [],
      ...(runs.has(record.id) ? { run: runs.get(record.id) } : {}),
      stamps: stamps.get(record.id) ?? [],
      commentCount: commentCounts.get(record.id) ?? 0,
      ...(withVideo.has(record.id) ? { hasVideo: true } : {}),
      ...(isNew(record, authorId) ? { isNew: true } : {}),
    }));

    return { weekStart, items, nextCursor: rows.length > FEED_PAGE_SIZE && last ? encodeCursor(last.record.recordedAt, last.record.id) : null, totals };
  }

  // 仲間タブの新着の印（F4）。基準は「最後に仲間タブを見た時刻」（一度も見ていなければ登録した時刻）。
  // 新着になるのは ①同じグループの自分以外の人の記録で、基準より後に作られたもの（あとから記録した前の週の日付でも、作った時刻で見る）
  //               ②自分の記録に、自分以外の人が基準より後に付けたスタンプ・コメント
  // 週は区切らない（前の週の日付であとから記録したものも知らせる）。足跡を読んだだけでは基準は進まない（markSeen だけが進める）
  async unread(userId: string): Promise<FeedUnreadResponse> {
    const seenAt = await this.watermark(userId);
    const [others] = await this.db
      .select({ one: sql`1` })
      .from(records)
      .where(and(ownerInMyGroup(this.db, userId), ne(records.userId, userId), gt(records.createdAt, seenAt)))
      .limit(1);
    if (others) return { hasNew: true };
    return { hasNew: (await this.myRecordsWithNewReactions(userId, seenAt)).size > 0 };
  }

  // 仲間タブを見た。基準を今にする。グループに入っていない人も呼べる（何も起きないのと同じ）
  async markSeen(userId: string): Promise<void> {
    await this.db.update(users).set({ feedSeenAt: sql`now()` }).where(eq(users.id, userId));
  }

  private async watermark(userId: string): Promise<Date> {
    const [row] = await this.db
      .select({ at: sql<Date>`coalesce(${users.feedSeenAt}, ${users.createdAt})`.mapWith(users.createdAt) })
      .from(users)
      .where(eq(users.id, userId));
    // セッションがあるのに users の行が無いことは起きない（better-auth が行を消すとセッションも消える）。念のため「全部新着ではない」側に倒す
    return row?.at ?? new Date();
  }

  // 自分の記録のうち、自分以外の人が seenAt より後にスタンプかコメントを付けたものの id。
  // ids を渡したときはその中だけ（足跡の1ページ分）。渡さなければ全部（新着があるかだけを見る）
  private async myRecordsWithNewReactions(userId: string, seenAt: Date, ids?: string[]): Promise<Set<string>> {
    if (ids && ids.length === 0) return new Set();
    const onlyIds = ids ? inArray(records.id, ids) : undefined;
    const [fromStamps, fromComments] = await Promise.all([
      this.db
        .selectDistinct({ id: records.id })
        .from(reactions)
        .innerJoin(records, eq(records.id, reactions.recordId))
        .where(and(eq(records.userId, userId), ne(reactions.userId, userId), gt(reactions.createdAt, seenAt), onlyIds)),
      this.db
        .selectDistinct({ id: records.id })
        .from(comments)
        .innerJoin(records, eq(records.id, comments.recordId))
        .where(and(eq(records.userId, userId), ne(comments.userId, userId), gt(comments.createdAt, seenAt), onlyIds)),
    ]);
    return new Set([...fromStamps, ...fromComments].map((r) => r.id));
  }

  // 動画が付いている記録の id（カードの再生の印。A06-4）。ids は足跡の1ページ分で、すでに見える範囲に絞られている。
  // 印だけで、動画の id・URL は返さない（見られるかどうかは動画の API が決める）
  private async recordsWithVideo(ids: string[]): Promise<Set<string>> {
    if (ids.length === 0) return new Set();
    const rows = await this.db.select({ recordId: videos.recordId }).from(videos).where(inArray(videos.recordId, ids));
    return new Set(rows.map((r) => r.recordId));
  }

  // 種目名の要約。重複なし・最初にセットを足した順（記録の詳細と同じ並び）
  private async exerciseNamesOf(ids: string[]): Promise<Map<string, string[]>> {
    const result = new Map<string, string[]>();
    if (ids.length === 0) return result;
    const rows = await this.db
      .select({ recordId: workoutSets.recordId, name: exercises.name })
      .from(workoutSets)
      .innerJoin(exercises, eq(exercises.id, workoutSets.exerciseId))
      .where(inArray(workoutSets.recordId, ids))
      .orderBy(asc(workoutSets.createdAt), asc(workoutSets.setNo), asc(workoutSets.id));
    for (const row of rows) {
      const names = result.get(row.recordId) ?? [];
      if (!names.includes(row.name)) names.push(row.name);
      result.set(row.recordId, names);
    }
    return result;
  }

  private async runsOf(ids: string[]): Promise<Map<string, { distanceM: number; durationS: number }>> {
    if (ids.length === 0) return new Map();
    const rows = await this.db
      .select({ recordId: runDetails.recordId, distanceM: runDetails.distanceM, durationS: runDetails.durationS })
      .from(runDetails)
      .where(inArray(runDetails.recordId, ids));
    return new Map(rows.map((r) => [r.recordId, { distanceM: r.distanceM, durationS: r.durationS }]));
  }

  // 記録ごとのスタンプ。付いたものだけ、スタンプの一覧の順に並べる。mine は自分のスタンプの id（外すときに使う）
  private async stampsOf(ids: string[], userId: string): Promise<Map<string, FeedStamp[]>> {
    const result = new Map<string, FeedStamp[]>();
    if (ids.length === 0) return result;
    const rows = await this.db
      .select({ id: reactions.id, recordId: reactions.recordId, userId: reactions.userId, userName: users.name, stampKey: reactions.stampKey })
      .from(reactions)
      .innerJoin(users, eq(users.id, reactions.userId))
      .where(inArray(reactions.recordId, ids))
      .orderBy(asc(reactions.createdAt), asc(reactions.id));
    for (const recordId of new Set(rows.map((r) => r.recordId))) {
      const of = rows.filter((r) => r.recordId === recordId);
      const list: FeedStamp[] = summarizeStamps(of, userId);
      result.set(recordId, list);
    }
    return result;
  }

  private async commentCountsOf(ids: string[]): Promise<Map<string, number>> {
    if (ids.length === 0) return new Map();
    const rows = await this.db
      .select({ recordId: comments.recordId, n: count() })
      .from(comments)
      .where(inArray(comments.recordId, ids))
      .groupBy(comments.recordId);
    return new Map(rows.map((r) => [r.recordId, Number(r.n)]));
  }

  // その週のグループ合計。ページに関係なく週全体を、足跡と同じ範囲（feedScope）で数える。
  //  ・記録した人数: 筋トレかランを記録した人（休みだけの人は数えない。休んでも仲間の数字は減らず、増えもしない）
  //  ・総重量: 重量×回数の合計 ・総距離: ランの距離の合計。順位・連続日数は持たない
  private async totals(scope: ReturnType<typeof feedScope>): Promise<FeedTotals> {
    const [people] = await this.db
      .select({ n: sql<string>`count(distinct ${records.userId})` })
      .from(records)
      .where(and(scope, inArray(records.kind, ['workout', 'run'])));
    const [volume] = await this.db
      .select({ sum: sql<string | null>`sum(${workoutSets.weightKg} * ${workoutSets.reps})` })
      .from(workoutSets)
      .innerJoin(records, eq(records.id, workoutSets.recordId))
      .where(scope);
    const [distance] = await this.db
      .select({ sum: sql<string | null>`sum(${runDetails.distanceM})` })
      .from(runDetails)
      .innerJoin(records, eq(records.id, runDetails.recordId))
      .where(scope);
    return { recordedUserCount: Number(people?.n ?? 0), totalVolumeKg: Number(volume?.sum ?? 0), totalDistanceM: Number(distance?.sum ?? 0) };
  }
}
