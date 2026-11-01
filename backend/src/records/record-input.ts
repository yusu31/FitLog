import { BadRequestException } from '@nestjs/common';
import { isUuid } from '../common/uuid.js';

// 今のところ作れる種類。ラン（run）は F-04 の PR で足す
export const CREATABLE_KINDS = ['workout', 'rest'] as const;
export type CreatableKind = (typeof CREATABLE_KINDS)[number];

// 端末の時計は少しずれるので、未来は5分先まで受け付ける（docs/testing-design.md T-DATE-07。5分1秒は 400）
export const FUTURE_LIMIT_MS = 5 * 60 * 1000;

// ISO 8601 の日時（タイムゾーンつき）。日付だけ・空白区切り・数値は受けない
const ISO = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])T([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(\.\d{1,3})?(Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/;

// 日時の文字列を Date にする。実在しない日付（2月30日など）は、JavaScript が3月2日に繰り上げてしまうので、年月日が元のままかを確かめる
export function parseIso(text: string): Date | undefined {
  const m = ISO.exec(text);
  if (!m) return undefined;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const calendar = new Date(Date.UTC(year, month - 1, day));
  if (calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day) return undefined;
  const at = new Date(text);
  return Number.isNaN(at.getTime()) ? undefined : at;
}

// 記録を作るときの入力検査（docs/design.md 4章 POST /records）。理由は項目ごとに集めて、1回で直せるようにする
export function parseRecordInput(raw: unknown, now: Date = new Date()): { id: string; kind: CreatableKind; recordedAt: Date } {
  const body = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  const details: string[] = [];

  const id = isUuid(body.id) ? body.id.toLowerCase() : undefined;
  if (!id) details.push('id: UUID で指定してください');

  const kind = (CREATABLE_KINDS as readonly unknown[]).includes(body.kind) ? (body.kind as CreatableKind) : undefined;
  if (!kind) details.push(`kind: ${CREATABLE_KINDS.join('・')} のどれかを指定してください`);

  const recordedAt = typeof body.recordedAt === 'string' ? parseIso(body.recordedAt) : undefined;
  if (!recordedAt) {
    details.push('recordedAt: ISO 8601 の日時（例: 2026-11-01T09:00:00+09:00）で指定してください');
  } else if (recordedAt.getTime() > now.getTime() + FUTURE_LIMIT_MS) {
    details.push('recordedAt: 未来の時刻は受け付けられません（5分先まで）');
  }

  if (!id || !kind || !recordedAt || details.length > 0) {
    throw new BadRequestException({ code: 'VALIDATION_ERROR', message: '入力が正しくありません', details });
  }
  return { id, kind, recordedAt };
}
