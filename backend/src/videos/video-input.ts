import { BadRequestException } from '@nestjs/common';
import { decodeCursor, type ListCursor } from '../records/list-input.js';

// 動画の大きさの上限 10MB（docs/design.md 4章・docs/database-design.md videos.size_bytes）。署名の条件に入れる
export const VIDEO_MAX_BYTES = 10_485_760;
// 撮影できた形式のまま保存する（F-13）。画面は ";codecs=..." を外した基本の形式だけを送る
export const VIDEO_CONTENT_TYPES = ['video/mp4', 'video/webm'] as const;
export type VideoContentType = (typeof VIDEO_CONTENT_TYPES)[number];

// 動画の一覧（A14-2）。自分の過去の動画は 1 回に 20 件（足跡と同じ）。今週の一覧は、5 人のグループが1週に撮る本数の上限の余裕として 100 件で打ち切る
export const VIDEO_PAGE_SIZE = 20;
export const VIDEO_WEEK_MAX = 100;

// GET /videos/mine のクエリの検査。cursor は前の応答の nextCursor だけ
export function parseMyVideosQuery(query: { cursor?: unknown }): { cursor: ListCursor | undefined } {
  if (query.cursor === undefined) return { cursor: undefined };
  const cursor = typeof query.cursor === 'string' ? decodeCursor(query.cursor) : undefined;
  if (!cursor) {
    throw new BadRequestException({ code: 'VALIDATION_ERROR', message: '入力が正しくありません', details: ['cursor: 前の応答の nextCursor をそのまま指定してください'] });
  }
  return { cursor };
}

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
