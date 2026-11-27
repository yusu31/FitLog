import { BadRequestException } from '@nestjs/common';
import { CAPTION_MAX } from './record-input.js';

// 記録のメモ・きつさ（F5）。メモは 0〜200 字、きつさ（RPE）は 1〜10 の整数。
// 項目を含めなければ「触らない」・null は「消す」。メモが空白だけなら消す扱い（null）
export const NOTE_MAX = 200;
export const RPE_MIN = 1;
export const RPE_MAX = 10;

export type MemoInput = { note?: string | null; rpe?: number | null; caption?: string | null };

export function parseMemoInput(raw: unknown): MemoInput {
  const body = typeof raw === 'object' && raw !== null && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const details: string[] = [];
  const out: MemoInput = {};

  if ('note' in body) {
    if (body.note === null) out.note = null;
    else if (typeof body.note !== 'string') details.push('note: 文字列か null で指定してください');
    else {
      const note = body.note.trim();
      // 数え方はコードポイント（DB の char_length と同じ）
      if (Array.from(note).length > NOTE_MAX) details.push(`note: ${NOTE_MAX}字までで入れてください`);
      else out.note = note === '' ? null : note;
    }
  }
  if ('rpe' in body) {
    if (body.rpe === null) out.rpe = null;
    else if (typeof body.rpe !== 'number' || !Number.isInteger(body.rpe) || body.rpe < RPE_MIN || body.rpe > RPE_MAX) {
      details.push(`rpe: ${RPE_MIN}〜${RPE_MAX} の整数か null で指定してください`);
    } else out.rpe = body.rpe;
  }
  // caption（ひとこと。仲間にも見える）は note と同じ扱い。1〜50字・空白だけなら消す
  if ('caption' in body) {
    if (body.caption === null) out.caption = null;
    else if (typeof body.caption !== 'string') details.push('caption: 文字列か null で指定してください');
    else {
      const caption = body.caption.trim();
      if (Array.from(caption).length > CAPTION_MAX) details.push(`caption: ${CAPTION_MAX}字までで入れてください`);
      else out.caption = caption === '' ? null : caption;
    }
  }
  if (details.length === 0 && Object.keys(out).length === 0) details.push('note・rpe・caption のどれかを指定してください');

  if (details.length > 0) {
    throw new BadRequestException({ code: 'VALIDATION_ERROR', message: '入力が正しくありません', details });
  }
  return out;
}
