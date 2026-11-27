import { ApiProperty } from '@nestjs/swagger';
import { MemberResponse } from '../groups/groups.response.js';
import { VIDEO_CONTENT_TYPES, VIDEO_MAX_BYTES, VIDEO_PAGE_SIZE, VIDEO_WEEK_MAX } from './video-input.js';

export class CreateVideoUploadRequest {
  @ApiProperty({ enum: VIDEO_CONTENT_TYPES, example: 'video/mp4', description: '撮影できた形式。";codecs=..." は付けない基本の形式だけ' })
  contentType!: string;

  @ApiProperty({ minimum: 1, maximum: VIDEO_MAX_BYTES, example: 1500000, description: '動画の大きさ（バイト）。署名の条件に「ちょうどこの大きさ」として入る。上限 10MB（10,485,760）' })
  sizeBytes!: number;
}

// S3 へブラウザから直接送るフォームの宛先と項目（署名付き POST）。fields はそのまま全部をフォームに入れ、最後に file を付けて url へ POST する
export class PresignedPostResponse {
  @ApiProperty({ example: 'https://fitlog-bucket.s3.ap-northeast-1.amazonaws.com/' })
  url!: string;

  @ApiProperty({ type: 'object', additionalProperties: { type: 'string' }, description: 'フォームに入れる項目（key・Content-Type・Policy・署名など）。順序と中身を変えない' })
  fields!: Record<string, string>;
}

export class VideoUploadResponse {
  @ApiProperty({ format: 'uuid', description: '動画の id。見るときの GET /videos/{id}/url に使う' })
  id!: string;

  @ApiProperty({ type: PresignedPostResponse })
  upload!: PresignedPostResponse;

  @ApiProperty({ example: 300, description: '署名付き POST の有効期限（秒）' })
  expiresInSeconds!: number;

  @ApiProperty({ example: '2026-11-01T15:00:00.000Z', description: '仲間に見える期限（記録の週の日曜 24:00 日本時間）。本人はこれを過ぎても見られる' })
  visibleUntil!: string;
}

export class VideoUrlResponse {
  @ApiProperty({ description: '動画を見る署名付き URL（短い期限）。ログに出さない' })
  url!: string;

  @ApiProperty({ example: 300, description: 'URL の有効期限（秒）' })
  expiresInSeconds!: number;
}

// 今週の動画の一覧（仲間タブのサムネ列。A14-2）。URL はここには入れない（見る条件は GET /videos/{id}/url が守る）
export class VideoWeekItem {
  @ApiProperty({ format: 'uuid', description: '動画の id。見るときの GET /videos/{id}/url に使う（locked のときは 403 VIDEO_LOCKED になる）' })
  id!: string;

  @ApiProperty({ format: 'uuid', description: '動画を付けた記録の id' })
  recordId!: string;

  @ApiProperty({ format: 'date-time', description: '運動した時刻（UTC）' })
  recordedAt!: string;

  @ApiProperty({ format: 'date-time', description: '仲間に見える期限（今週の日曜 24:00 日本時間）' })
  visibleUntil!: string;

  @ApiProperty({ description: '自分の動画なら true（条件なしで見られる）' })
  mine!: boolean;

  @ApiProperty({ type: MemberResponse, description: '撮った人' })
  author!: MemberResponse;
}

export class VideoWeekResponse {
  @ApiProperty({ example: '2026-11-16', description: '今週の月曜の日付（日本時間）' })
  weekStart!: string;

  @ApiProperty({
    description:
      '自分が今週1本以上撮っていれば true。false のとき、mine=false の動画は見られない（ぼかして「1本撮ると見られる」を出す。URL を取ると 403 VIDEO_LOCKED）。mine=true の動画は条件なし',
  })
  unlocked!: boolean;

  @ApiProperty({ type: [VideoWeekItem], description: `今週の同じグループの人（自分を含む）の動画。新しい順（運動した時刻の降順）。最大 ${VIDEO_WEEK_MAX} 件。グループに入っていなければ自分の分だけ` })
  items!: VideoWeekItem[];
}

// 自分の過去の動画（「自分」タブのグリッド。A14-2）。自分の分は条件なし
export class MyVideoItem {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid', description: '動画を付けた記録の id' })
  recordId!: string;

  @ApiProperty({ format: 'date-time', description: '運動した時刻（UTC）' })
  recordedAt!: string;

  @ApiProperty({ example: '2026-11-02', description: '日本時間の日付（YYYY-MM-DD）' })
  localDate!: string;

  @ApiProperty({ format: 'date-time', description: '仲間に見える期限。本人はこれを過ぎても見られる' })
  visibleUntil!: string;
}

export class MyVideosResponse {
  @ApiProperty({ type: [MyVideoItem], description: `新しい順（運動した時刻の降順。同じ時刻は記録 id の降順）。1回に ${VIDEO_PAGE_SIZE} 件` })
  items!: MyVideoItem[];

  @ApiProperty({ type: String, nullable: true, description: '続きがあるときの印。次の呼び出しの cursor にそのまま渡す。最後のページは null' })
  nextCursor!: string | null;
}

export class DeleteVideoResponse {
  @ApiProperty({ description: '投稿の動画を消したので、投稿ごと消えた（true）。ほかの種類は動画だけ消えて記録は残る（false）' })
  recordDeleted!: boolean;
}
