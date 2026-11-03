import { BadRequestException } from '@nestjs/common';
import { isUuid } from '../common/uuid.js';
import { weekStartOf } from '../common/week.js';
import { decodeCursor, type ListCursor } from '../records/list-input.js';
import { parseWeekDate } from '../records/week-input.js';
import { isStampKey, type StampKey } from './stamps.js';

// コメントの上限（DB の CHECK comments_body_ck と同じ 50）
export const COMMENT_BODY_MAX = 50;

// 足跡は 1 回に 20 件（features.md UC-14。件数は変えられない）
export const FEED_PAGE_SIZE = 20;

const invalid = (details: string[]) => new BadRequestException({ code: 'VALIDATION_ERROR', message: '入力が正しくありません', details });

// GET /feed のクエリの検査。weekStart は実在する日付（その日を含む週の月曜に直す）。cursor は前の応答の nextCursor だけ。
// 理由は項目ごとに集めて、1回で直せるようにする
export function parseFeedQuery(query: { weekStart?: unknown; cursor?: unknown }): { weekStart: string; cursor: ListCursor | undefined } {
  const details: string[] = [];

  let weekStart = '';
  try {
    weekStart = weekStartOf(parseWeekDate(query.weekStart, 'weekStart'));
  } catch (err) {
    details.push(...((err as BadRequestException).getResponse() as { details: string[] }).details);
  }

  let cursor: ListCursor | undefined;
  if (query.cursor !== undefined) {
    cursor = typeof query.cursor === 'string' ? decodeCursor(query.cursor) : undefined;
    if (!cursor) details.push('cursor: 前の応答の nextCursor をそのまま指定してください');
  }

  if (details.length > 0) throw invalid(details);
  return { weekStart, cursor };
}

// POST /records/{id}/reactions の本文。stampKey は固定の一覧にあるものだけ
export function parseReactionInput(raw: unknown): { id: string; stampKey: StampKey } {
  const body = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  const details: string[] = [];
  const id = isUuid(body.id) ? body.id.toLowerCase() : undefined;
  if (!id) details.push('id: UUID で指定してください');
  if (!isStampKey(body.stampKey)) details.push('stampKey: 一覧にあるスタンプのキーを指定してください');
  if (details.length > 0) throw invalid(details);
  return { id: id!, stampKey: body.stampKey as StampKey };
}

// コメントの文字数。Unicode のコードポイント数で数える（絵文字1つも1字。画面の Array.from(text).length・DB の char_length と同じ。design.md 7章）
export const commentLength = (text: string): number => Array.from(text).length;

// POST /records/{id}/comments の本文。1〜50 字。空白だけは受けない（testing-design.md T-CMT-07 の既定）。本文はそのまま保存する（前後の空白も削らない）
export function parseCommentInput(raw: unknown): { id: string; body: string } {
  const input = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  const details: string[] = [];
  const id = isUuid(input.id) ? input.id.toLowerCase() : undefined;
  if (!id) details.push('id: UUID で指定してください');

  const body = typeof input.body === 'string' ? input.body : undefined;
  if (body === undefined) details.push(`body: 1〜${COMMENT_BODY_MAX} 字の文字列で指定してください`);
  else if (body.trim() === '') details.push('body: 空白だけのコメントは付けられません');
  else if (commentLength(body) > COMMENT_BODY_MAX) details.push(`body: ${COMMENT_BODY_MAX} 字までです`);

  if (details.length > 0) throw invalid(details);
  return { id: id!, body: body! };
}
