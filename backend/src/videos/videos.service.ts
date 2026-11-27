import { ConflictException, ForbiddenException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { and, desc, eq, lt, or } from 'drizzle-orm';
import { toLocalDate } from '../common/local-date.js';
import { isUuid } from '../common/uuid.js';
import { weekStartOf } from '../common/week.js';
import { DB, type Db } from '../db/db.module.js';
import { records, users, videos } from '../db/schema.js';
import { encodeCursor } from '../records/list-input.js';
import { visibleToMe } from '../records/record-access.js';
import { visibleUntilOf } from './video-expiry.js';
import { hasShotThisWeek } from './video-gate.js';
import { parseMyVideosQuery, parseVideoInput, VIDEO_PAGE_SIZE, VIDEO_WEEK_MAX } from './video-input.js';
import { VIDEO_URL_EXPIRES_SECONDS, VideoStorage } from './video-storage.js';
import type { MyVideosResponse, VideoUploadResponse, VideoUrlResponse, VideoWeekItem, VideoWeekResponse } from './videos.response.js';

const recordNotFound = () => new NotFoundException({ code: 'RECORD_NOT_FOUND', message: '記録が見つかりません', details: null });
const videoNotFound = () => new NotFoundException({ code: 'VIDEO_NOT_FOUND', message: '動画が見つかりません', details: null });

// 動画（F-13。docs/design.md 4章）。API は署名付き URL を発行するだけで、動画の中身は通らない（ブラウザが S3 へ直接置く・読む）
@Injectable()
export class VideosService {
  private readonly logger = new Logger(VideosService.name);

  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly storage: VideoStorage,
  ) {}

  // 置くための署名付き POST を発行し、videos の行を作る（自分の筋トレの記録だけ）。
  // 1記録に1本。置くのに失敗してやり直すときは、同じ記録にもう一度呼ぶ（行は1つのまま、新しい申告に更新し、同じキーで署名し直す。200）。
  // 署名を先に作る: 置き場が設定されていないときに、行だけが残らないようにするため
  async issueUpload(userId: string, recordId: string, raw: unknown): Promise<{ created: boolean; video: VideoUploadResponse }> {
    const input = parseVideoInput(raw);
    if (!isUuid(recordId)) throw recordNotFound();
    const id = recordId.toLowerCase();

    const [record] = await this.db.select({ userId: records.userId, kind: records.kind, recordedAt: records.recordedAt, late: records.late }).from(records).where(eq(records.id, id));
    if (!record || record.userId !== userId) throw recordNotFound();
    // どの種類の記録にも動画を付けられる（筋トレ・ラン・休み・投稿。PR 4）
    // あとから記録（late）は日付をさかのぼって登録するので、公開期限（記録の週の日曜まで）が過ぎていることがある。動画は付けない（F-21）
    if (record.late) {
      throw new ConflictException({ code: 'RECORD_LATE', message: 'あとから記録した分には動画を付けられません', details: null });
    }

    const s3Key = `videos/${id}`;
    const upload = await this.storage.presignUpload(s3Key, input.contentType, input.sizeBytes);

    const [existing] = await this.db.select({ id: videos.id }).from(videos).where(eq(videos.recordId, id));
    // 同時に2つ届いても、一意制約（record_id）が1行にまとめる
    const [row] = await this.db
      .insert(videos)
      .values({ recordId: id, s3Key, contentType: input.contentType, sizeBytes: input.sizeBytes, visibleUntil: visibleUntilOf(record.recordedAt) })
      .onConflictDoUpdate({ target: videos.recordId, set: { contentType: input.contentType, sizeBytes: input.sizeBytes } })
      .returning();
    // 署名付き URL・フォームの中身はログに出さない（docs/design.md 6章）
    this.logger.log(`動画の署名付き POST を発行: ${row!.id}`);
    return { created: !existing, video: { id: row!.id, upload, expiresInSeconds: VIDEO_URL_EXPIRES_SECONDS, visibleUntil: row!.visibleUntil.toISOString() } };
  }

  // 動画だけ消す（PR 4）。自分の記録の動画だけ（他人の記録・動画の無い記録は 404）。
  // 投稿（post）は動画がなければ中身が無いので、動画を消したら投稿ごと消す（recordDeleted=true）。ほかの種類は動画だけ消して記録は残す。
  // S3 の削除に失敗しても成功にする（置き場の不具合で消せなくなるのを避ける。記録の削除と同じ。失敗はログに残す）
  async deleteVideo(userId: string, recordId: string): Promise<{ recordDeleted: boolean }> {
    if (!isUuid(recordId)) throw recordNotFound();
    const id = recordId.toLowerCase();
    const [row] = await this.db
      .select({ videoId: videos.id, s3Key: videos.s3Key, kind: records.kind })
      .from(videos)
      .innerJoin(records, eq(records.id, videos.recordId))
      .where(and(eq(records.id, id), eq(records.userId, userId)));
    if (!row) {
      const [record] = await this.db.select({ userId: records.userId }).from(records).where(eq(records.id, id));
      if (!record || record.userId !== userId) throw recordNotFound();
      throw videoNotFound();
    }
    const recordDeleted = row.kind === 'post';
    // 投稿は記録ごと消す（動画の行は ON DELETE CASCADE で一緒に消える）
    if (recordDeleted) await this.db.delete(records).where(and(eq(records.id, id), eq(records.userId, userId)));
    else await this.db.delete(videos).where(eq(videos.id, row.videoId));
    this.logger.log(`動画を削除: ${row.videoId}${recordDeleted ? '（投稿ごと）' : ''}`);
    try {
      await this.storage.deleteMany([row.s3Key]);
    } catch (err) {
      this.logger.warn(`動画ファイルを消せなかった。削除は成功にする: ${err instanceof Error ? err.message : String(err)}`);
    }
    return { recordDeleted };
  }

  // 見るための署名付き URL を発行する。本人はいつでも。仲間は visible_until の前だけ（以後は 403）。
  // 別のグループの人・グループに入っていない人・無い id は、どれも同じ 404（存在を教えない）。見える範囲は共通の関数（record-access.ts）
  async viewUrl(userId: string, videoId: string): Promise<VideoUrlResponse> {
    if (!isUuid(videoId)) throw videoNotFound();
    const [row] = await this.db
      .select({ s3Key: videos.s3Key, visibleUntil: videos.visibleUntil, ownerId: records.userId })
      .from(videos)
      .innerJoin(records, eq(records.id, videos.recordId))
      .where(and(eq(videos.id, videoId.toLowerCase()), visibleToMe(this.db, userId)));
    if (!row) throw videoNotFound();
    if (row.ownerId !== userId && Date.now() >= row.visibleUntil.getTime()) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'この動画を見られる期限を過ぎました', details: null });
    }
    // 仲間の動画は、今週、自分も撮っていれば見られる（案B）。本人の動画は条件なし。条件を満たさないとき 403 VIDEO_LOCKED
    if (row.ownerId !== userId && !(await this.shotThisWeek(userId))) {
      throw new ForbiddenException({ code: 'VIDEO_LOCKED', message: 'あなたも2秒撮ると見られます', details: null });
    }
    return { url: await this.storage.presignDownload(row.s3Key), expiresInSeconds: VIDEO_URL_EXPIRES_SECONDS };
  }

  // 今週の動画の一覧（仲間タブのサムネ列。A14-2）。同じグループの人（自分を含む）の、見える期限が今週の動画だけ。
  // 見える範囲は URL の発行と同じ共通の関数（visibleToMe）。見られるかどうかの条件も同じ（shotThisWeek）で、unlocked に1回だけ載せる。
  // この API は URL を返さない（URL の発行が条件を守る）。locked のとき、画面はぼかして「1本撮ると見られる」を出す
  async weekList(userId: string): Promise<VideoWeekResponse> {
    const now = new Date();
    const rows = await this.db
      .select({ id: videos.id, recordId: videos.recordId, recordedAt: records.recordedAt, visibleUntil: videos.visibleUntil, authorId: users.id, authorName: users.name, authorAvatar: users.avatar })
      .from(videos)
      .innerJoin(records, eq(records.id, videos.recordId))
      .innerJoin(users, eq(users.id, records.userId))
      .where(and(eq(videos.visibleUntil, visibleUntilOf(now)), visibleToMe(this.db, userId)))
      .orderBy(desc(records.recordedAt), desc(videos.id))
      .limit(VIDEO_WEEK_MAX);
    return {
      weekStart: weekStartOf(toLocalDate(now)),
      unlocked: await this.shotThisWeek(userId),
      items: rows.map((r) => ({
        id: r.id,
        recordId: r.recordId,
        recordedAt: r.recordedAt.toISOString(),
        visibleUntil: r.visibleUntil.toISOString(),
        mine: r.authorId === userId,
        author: { id: r.authorId, name: r.authorName, avatar: r.authorAvatar as VideoWeekItem['author']['avatar'] },
      })),
    };
  }

  // 自分の過去の動画（「自分」タブのグリッド）。自分の分だけ・条件なし。新しい順・20件ずつ（続きは記録の時刻と id の組。足跡と同じ cursor）
  async myList(userId: string, rawQuery: { cursor?: unknown }): Promise<MyVideosResponse> {
    const { cursor } = parseMyVideosQuery(rawQuery);
    const rows = await this.db
      .select({ id: videos.id, recordId: videos.recordId, recordedAt: records.recordedAt, localDate: records.localDate, visibleUntil: videos.visibleUntil })
      .from(videos)
      .innerJoin(records, eq(records.id, videos.recordId))
      .where(
        and(
          eq(records.userId, userId),
          cursor ? or(lt(records.recordedAt, cursor.recordedAt), and(eq(records.recordedAt, cursor.recordedAt), lt(records.id, cursor.id))) : undefined,
        ),
      )
      .orderBy(desc(records.recordedAt), desc(records.id))
      .limit(VIDEO_PAGE_SIZE + 1);
    const page = rows.slice(0, VIDEO_PAGE_SIZE);
    const last = page[page.length - 1];
    return {
      items: page.map((r) => ({ id: r.id, recordId: r.recordId, recordedAt: r.recordedAt.toISOString(), localDate: r.localDate, visibleUntil: r.visibleUntil.toISOString() })),
      nextCursor: rows.length > VIDEO_PAGE_SIZE && last ? encodeCursor(last.recordedAt, last.recordId) : null,
    };
  }

  // 今週、自分の動画が1本以上あるか。「撮った」は動画の行ができた時点で数える（置き終わりの確認まではしない）
  private async shotThisWeek(userId: string): Promise<boolean> {
    const mine = await this.db
      .select({ visibleUntil: videos.visibleUntil })
      .from(videos)
      .innerJoin(records, eq(records.id, videos.recordId))
      .where(eq(records.userId, userId));
    return hasShotThisWeek(new Date(), mine.map((m) => m.visibleUntil));
  }
}
