import { BadRequestException } from '@nestjs/common';
import { isUuid } from '../common/uuid.js';
import { RECORD_KINDS, type RecordKind } from '../db/schema.js';

// 設計書に件数の上限が無かったので、既定 20（design.md 4章）・上限 100 とした（docs/design.md 7章）。
// 上限が無いと、1回の呼び出しで全件を取れてしまい、応答が大きくなる
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

export type ListCursor = { recordedAt: Date; id: string };
export type ListQuery = { limit: number; cursor: ListCursor | undefined; kind: RecordKind | undefined };

// 続きの印。「ここまで読んだ最後の記録」の時刻（ミリ秒）と id を base64url にしたもの。画面は中身を見ずに、そのまま次の呼び出しに渡す。
// ページ番号（offset）にしないのは、読んでいる間に記録が増えても重複・抜けが出ないようにするため
export const encodeCursor = (recordedAt: Date, id: string): string => Buffer.from(JSON.stringify({ t: recordedAt.getTime(), id })).toString('base64url');

export function decodeCursor(raw: string): ListCursor | undefined {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return undefined;
    const { t, id } = parsed as { t?: unknown; id?: unknown };
    if (typeof t !== 'number' || !Number.isFinite(t) || !isUuid(id)) return undefined;
    const recordedAt = new Date(t);
    // 日付として表せない大きさの数は、ここで弾く
    if (Number.isNaN(recordedAt.getTime())) return undefined;
    return { recordedAt, id: id.toLowerCase() };
  } catch {
    return undefined;
  }
}

// GET /records のクエリの検査。理由は項目ごとに集めて、1回で直せるようにする
export function parseListQuery(query: { limit?: unknown; cursor?: unknown; kind?: unknown }): ListQuery {
  const details: string[] = [];

  let limit = DEFAULT_LIMIT;
  if (query.limit !== undefined) {
    // 数字だけの文字列（"20"）を受ける。"1.5"・"1e1"・" 5"・"" は受けない
    if (typeof query.limit === 'string' && /^\d{1,4}$/.test(query.limit) && Number(query.limit) >= 1 && Number(query.limit) <= MAX_LIMIT) limit = Number(query.limit);
    else details.push(`limit: 1〜${MAX_LIMIT} の整数で指定してください`);
  }

  let kind: RecordKind | undefined;
  if (query.kind !== undefined) {
    if (typeof query.kind === 'string' && (RECORD_KINDS as readonly string[]).includes(query.kind)) kind = query.kind as RecordKind;
    else details.push(`kind: ${RECORD_KINDS.join('・')} のどれかで指定してください`);
  }

  let cursor: ListCursor | undefined;
  if (query.cursor !== undefined) {
    cursor = typeof query.cursor === 'string' ? decodeCursor(query.cursor) : undefined;
    if (!cursor) details.push('cursor: 前の応答の nextCursor をそのまま指定してください');
  }

  if (details.length > 0) {
    throw new BadRequestException({ code: 'VALIDATION_ERROR', message: '入力が正しくありません', details });
  }
  return { limit, cursor, kind };
}
