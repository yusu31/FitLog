import { ConflictException, ForbiddenException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { isUuid } from '../common/uuid.js';
import { DB, type Db } from '../db/db.module.js';
import { records, videos } from '../db/schema.js';
import { visibleToMe } from '../records/record-access.js';
import { visibleUntilOf } from './video-expiry.js';
import { hasShotThisWeek } from './video-gate.js';
import { parseVideoInput } from './video-input.js';
import { VIDEO_URL_EXPIRES_SECONDS, VideoStorage } from './video-storage.js';
import type { VideoUploadResponse, VideoUrlResponse } from './videos.response.js';

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
    if (record.kind !== 'workout') {
      throw new ConflictException({ code: 'RECORD_KIND_MISMATCH', message: '筋トレの記録にだけ動画を付けられます', details: null });
    }
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
