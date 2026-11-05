import { ApiProperty } from '@nestjs/swagger';
import { VIDEO_CONTENT_TYPES, VIDEO_MAX_BYTES } from './video-input.js';

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
