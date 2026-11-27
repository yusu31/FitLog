import { Inject, Injectable } from '@nestjs/common';
import { and, asc, between, count, desc, eq, gt, inArray, lt, ne, or, sql } from 'drizzle-orm';
import { beatsPast, milestoneOf } from '../common/achievements.js';
import { toLocalDate } from '../common/local-date.js';
import { buildStats, type StampKey as BookStampKey } from '../common/stats.js';
import { weekDates, weekStartOf } from '../common/week.js';
import { DB, type Db } from '../db/db.module.js';
import { type BodyPart, comments, exercises, reactions, records, runDetails, users, videos, workoutSets } from '../db/schema.js';
import { loadDayAggs } from '../records/day-aggs.js';
import { encodeCursor } from '../records/list-input.js';
import { ownerInMyGroup } from '../records/record-access.js';
import { FEED_PAGE_SIZE, parseFeedQuery } from './feed-input.js';
import type { FeedItem, FeedResponse, FeedStamp, FeedTopSet, FeedTotals, FeedUnreadResponse } from './feed.response.js';
import { summarizeStamps } from './stamps.js';

// 仲間の足跡と週の合計（F-09。docs/design.md 3章 GET /feed・6章）。

// 足跡と合計が取る記録の範囲を決める、この API で唯一の関数。
// 「同じグループの人の記録」（record-access.ts の ownerInMyGroup。グループに入っていなければ何も当たらない）と、
// 「その週（月曜〜日曜の local_date）」を必ず一緒に付ける。足跡の一覧も、合計の3本の集計も、ここを通す
export function feedScope(db: Db, userId: string, weekStart: string) {
  const dates = weekDates(weekStart);
  return and(ownerInMyGroup(db, userId), between(records.localDate, dates[0], dates[6]));
}

type Achievement = { pbExercises: Set<string>; longestRun: boolean; milestoneDay?: number; earnedStamps: BookStampKey[] };

// 達成チップの材料を、API の形（付いていないものは省く）に直す。種目名は足跡の並び（最初にセットを足した順）に合わせる
function achievementFields(a: Achievement | undefined, names: string[]): Pick<FeedItem, 'personalBestExercises' | 'longestRun' | 'milestoneDay' | 'earnedStamps'> {
  if (!a) return {};
  const pb = names.filter((n) => a.pbExercises.has(n));
  return {
    ...(pb.length > 0 ? { personalBestExercises: pb } : {}),
    ...(a.longestRun ? { longestRun: true } : {}),
    ...(a.milestoneDay ? { milestoneDay: a.milestoneDay } : {}),
    ...(a.earnedStamps.length > 0 ? { earnedStamps: a.earnedStamps } : {}),
  };
}

@Injectable()
export class FeedService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async feed(userId: string, rawQuery: { weekStart?: unknown; cursor?: unknown }): Promise<FeedResponse> {
    const { weekStart: requested, cursor } = parseFeedQuery(rawQuery);
    // 週を指定しない（D7-6）と、足跡は同じグループの全期間。合計は常に1週間ぶん（指定した週、なければ今週）
    const weekStart = requested ?? weekStartOf(toLocalDate(new Date()));
    const weekScope = feedScope(this.db, userId, weekStart);
    const scope = requested ? weekScope : ownerInMyGroup(this.db, userId);

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
    const [workouts, runs, stamps, commentCounts, totals, reactedMine, withVideo, achievements] = await Promise.all([
      this.workoutsOf(ids),
      this.runsOf(ids),
      this.stampsOf(ids, userId),
      this.commentCountsOf(ids),
      this.totals(weekScope),
      this.myRecordsWithNewReactions(userId, seenAt, ids),
      this.recordsWithVideo(ids),
      this.achievementsOf(page.map((r) => ({ record: r.record, authorId: r.authorId }))),
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
      exerciseNames: workouts.get(record.id)?.names ?? [],
      ...(workouts.has(record.id) ? { topSet: workouts.get(record.id)!.top, bodyParts: workouts.get(record.id)!.parts } : {}),
      ...(runs.has(record.id) ? { run: runs.get(record.id) } : {}),
      ...(record.caption ? { caption: record.caption } : {}),
      ...achievementFields(achievements.get(record.id), workouts.get(record.id)?.names ?? []),
      stamps: stamps.get(record.id) ?? [],
      commentCount: commentCounts.get(record.id) ?? 0,
      ...(withVideo.has(record.id) ? { hasVideo: true, videoId: withVideo.get(record.id)!.id, videoVisibleUntil: withVideo.get(record.id)!.visibleUntil } : {}),
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
    // 仲間のいちばん新しい記録（右下の知らせの材料）。新着の判定にも使う（基準より後に作られていれば新着）
    const [latest] = await this.db
      .select({ id: records.id, kind: records.kind, createdAt: records.createdAt, authorName: users.name })
      .from(records)
      .innerJoin(users, eq(users.id, records.userId))
      .where(and(ownerInMyGroup(this.db, userId), ne(records.userId, userId)))
      .orderBy(desc(records.createdAt), desc(records.id))
      .limit(1);
    const latestFriendRecord = latest ? { id: latest.id, kind: latest.kind, authorName: latest.authorName, createdAt: latest.createdAt.toISOString() } : undefined;
    const hasNew = (latest !== undefined && latest.createdAt > seenAt) || (await this.myRecordsWithNewReactions(userId, seenAt)).size > 0;
    return { hasNew, ...(latestFriendRecord ? { latestFriendRecord } : {}) };
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
  private async recordsWithVideo(ids: string[]): Promise<Map<string, { id: string; visibleUntil: string }>> {
    if (ids.length === 0) return new Map();
    const rows = await this.db.select({ id: videos.id, recordId: videos.recordId, visibleUntil: videos.visibleUntil }).from(videos).where(inArray(videos.recordId, ids));
    return new Map(rows.map((r) => [r.recordId, { id: r.id, visibleUntil: r.visibleUntil.toISOString() }]));
  }

  // 達成チップの材料（カードの帯。休み・投稿には付けない）。どれも都度計算で、DB に持たない。
  //  ・自己ベスト: その記録の最大（重量×回数）が、その人・その種目の、これより前の記録の最大を超えた（初めての種目は除く）。ランは距離が、これより前のランのどれよりも長い
  //  ・節目・スタンプ: その日に運動した日数が 1・7・30・100 日目になった／スタンプ帳で初めて取った。同じ日に何件あっても、その日の最初の記録にだけ付ける
  private async achievementsOf(page: { record: typeof records.$inferSelect; authorId: string }[]): Promise<Map<string, Achievement>> {
    const result = new Map<string, Achievement>();
    const targets = page.filter((p) => p.record.kind === 'workout' || p.record.kind === 'run');
    if (targets.length === 0) return result;
    const authorIds = [...new Set(targets.map((t) => t.authorId))];
    const dates = [...new Set(targets.map((t) => t.record.localDate))];
    const targetIds = targets.map((t) => t.record.id);
    for (const t of targets) result.set(t.record.id, { pbExercises: new Set(), longestRun: false, earnedStamps: [] });

    // 筋トレの自己ベスト
    const exerciseRows = await this.db.selectDistinct({ exerciseId: workoutSets.exerciseId }).from(workoutSets).where(inArray(workoutSets.recordId, targetIds));
    if (exerciseRows.length > 0) {
      const maxes = await this.db
        .select({
          recordId: workoutSets.recordId,
          userId: records.userId,
          exerciseId: workoutSets.exerciseId,
          name: exercises.name,
          recordedAt: records.recordedAt,
          volume: sql<string>`max(${workoutSets.weightKg} * ${workoutSets.reps})`,
        })
        .from(workoutSets)
        .innerJoin(records, eq(records.id, workoutSets.recordId))
        .innerJoin(exercises, eq(exercises.id, workoutSets.exerciseId))
        .where(and(inArray(records.userId, authorIds), inArray(workoutSets.exerciseId, exerciseRows.map((e) => e.exerciseId))))
        .groupBy(workoutSets.recordId, records.userId, workoutSets.exerciseId, exercises.name, records.recordedAt);
      for (const row of maxes) {
        const entry = result.get(row.recordId);
        if (!entry) continue;
        const past = maxes.filter((o) => o.userId === row.userId && o.exerciseId === row.exerciseId && o.recordedAt < row.recordedAt).map((o) => Number(o.volume));
        if (beatsPast(Number(row.volume), past.length > 0 ? Math.max(...past) : null)) entry.pbExercises.add(row.name);
      }
    }

    // ランの自己ベスト（一番長い距離）
    const runRows = await this.db
      .select({ recordId: runDetails.recordId, userId: records.userId, distanceM: runDetails.distanceM, recordedAt: records.recordedAt })
      .from(runDetails)
      .innerJoin(records, eq(records.id, runDetails.recordId))
      .where(inArray(records.userId, authorIds));
    for (const row of runRows) {
      const entry = result.get(row.recordId);
      if (!entry) continue;
      const past = runRows.filter((o) => o.userId === row.userId && o.recordedAt < row.recordedAt).map((o) => o.distanceM);
      if (beatsPast(row.distanceM, past.length > 0 ? Math.max(...past) : null)) entry.longestRun = true;
    }

    // 節目・スタンプは、その日の最初の記録にだけ
    const dayRows = await this.db
      .select({ id: records.id, userId: records.userId, localDate: records.localDate })
      .from(records)
      .where(and(inArray(records.userId, authorIds), inArray(records.localDate, dates), inArray(records.kind, ['workout', 'run'])))
      .orderBy(asc(records.recordedAt), asc(records.id));
    const firstOfDay = new Map<string, string>();
    for (const row of dayRows) if (!firstOfDay.has(`${row.userId}|${row.localDate}`)) firstOfDay.set(`${row.userId}|${row.localDate}`, row.id);

    const today = toLocalDate(new Date());
    for (const authorId of authorIds) {
      const aggs = await loadDayAggs(this.db, authorId);
      const recDates = aggs.filter((d) => d.status === 'rec').map((d) => d.date);
      const stamps = buildStats(aggs, today).stamps;
      for (const t of targets.filter((x) => x.authorId === authorId)) {
        if (firstOfDay.get(`${authorId}|${t.record.localDate}`) !== t.record.id) continue;
        const entry = result.get(t.record.id)!;
        entry.milestoneDay = milestoneOf(recDates, t.record.localDate);
        entry.earnedStamps = stamps.filter((st) => st.earnedAt === t.record.localDate).map((st) => st.key);
      }
    }
    return result;
  }

  // 筋トレの要約（D7-6）。種目名と部位は重複なし・最初にセットを足した順（記録の詳細と同じ並び）。
  // top は一番重いセット（同じ重さなら回数が多い方、それも同じなら先に足した方）。セットの無い記録は入らない
  private async workoutsOf(ids: string[]): Promise<Map<string, { names: string[]; parts: BodyPart[]; top: FeedTopSet }>> {
    const result = new Map<string, { names: string[]; parts: BodyPart[]; top: FeedTopSet }>();
    if (ids.length === 0) return result;
    const rows = await this.db
      .select({ recordId: workoutSets.recordId, name: exercises.name, part: exercises.bodyPart, weightKg: workoutSets.weightKg, reps: workoutSets.reps })
      .from(workoutSets)
      .innerJoin(exercises, eq(exercises.id, workoutSets.exerciseId))
      .where(inArray(workoutSets.recordId, ids))
      .orderBy(asc(workoutSets.createdAt), asc(workoutSets.setNo), asc(workoutSets.id));
    for (const row of rows) {
      const set: FeedTopSet = { exerciseName: row.name, weightKg: Number(row.weightKg), reps: row.reps };
      const entry = result.get(row.recordId);
      if (!entry) {
        result.set(row.recordId, { names: [row.name], parts: [row.part], top: set });
        continue;
      }
      if (!entry.names.includes(row.name)) entry.names.push(row.name);
      if (!entry.parts.includes(row.part)) entry.parts.push(row.part);
      if (set.weightKg > entry.top.weightKg || (set.weightKg === entry.top.weightKg && set.reps > entry.top.reps)) entry.top = set;
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
