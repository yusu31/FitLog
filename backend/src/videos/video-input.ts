import { BadRequestException } from '@nestjs/common';

// 動画の大きさの上限 10MB（docs/design.md 4章・docs/database-design.md videos.size_bytes）。署名の条件に入れる
export const VIDEO_MAX_BYTES = 10_485_760;
// 撮影できた形式のまま保存する（F-13）。画面は ";codecs=..." を外した基本の形式だけを送る
export const VIDEO_CONTENT_TYPES = ['video/mp4', 'video/webm'] as const;
export type VideoContentType = (typeof VIDEO_CONTENT_TYPES)[number];

export type VideoInput = { contentType: VideoContentType; sizeBytes: number };

const isContentType = (v: unknown): v is VideoContentType => typeof v === 'string' && (VIDEO_CONTENT_TYPES as readonly string[]).includes(v);

// 署名付き POST を頼むときの入力検査（docs/design.md 4章 POST /records/{id}/video）。
// 大きさと形式は画面の申告。署名の条件（大きさは申告値ちょうど・形式は完全一致）に入れるので、S3 が申告と違うものを受け付けない。
// 理由は項目ごとに集めて、1回で直せるようにする
export function parseVideoInput(raw: unknown): VideoInput {
  const body = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  const details: string[] = [];

  if (!isContentType(body.contentType)) details.push(`contentType: ${VIDEO_CONTENT_TYPES.join(' か ')} で指定してください`);
  if (typeof body.sizeBytes !== 'number' || !Number.isInteger(body.sizeBytes) || body.sizeBytes < 1 || body.sizeBytes > VIDEO_MAX_BYTES) {
    details.push(`sizeBytes: 1〜${VIDEO_MAX_BYTES} の整数で指定してください`);
  }

  if (details.length > 0) {
    throw new BadRequestException({ code: 'VALIDATION_ERROR', message: '入力が正しくありません', details });
  }
  return { contentType: body.contentType as VideoContentType, sizeBytes: body.sizeBytes as number };
}
