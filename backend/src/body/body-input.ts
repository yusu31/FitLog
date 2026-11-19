import { BadRequestException } from '@nestjs/common';
import { ACTIVE_TIMES, BIO_MAX, BODY_KINDS } from '../db/schema.js';

const invalid = (details: string[]) => new BadRequestException({ code: 'VALIDATION_ERROR', message: '入力が正しくありません', details });
const asObject = (raw: unknown): Record<string, unknown> => (typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {});
const isTenth = (n: number): boolean => Math.abs(n * 10 - Math.round(n * 10)) < 1e-6;

export const HEIGHT_MIN = 100;
export const HEIGHT_MAX = 250;
export const WEIGHT_MIN = 20;
export const WEIGHT_MAX = 300;

// 今日（日本時間）の日付
export const todayJst = (now: Date = new Date()): string => new Date(now.getTime() + 9 * 3_600_000).toISOString().slice(0, 10);

// YYYY-MM-DD の実在する日付で、2000-01-01 以降・今日（日本時間）以前
export function parseMeasuredOn(raw: unknown, now: Date = new Date()): string {
  const bad = () => invalid(['date: 2000-01-01 から今日までの日付（YYYY-MM-DD）で指定してください']);
  if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw bad();
  const parsed = new Date(`${raw}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== raw) throw bad();
  if (raw < '2000-01-01' || raw > todayJst(now)) throw bad();
  return raw;
}

// PUT /body/weights/{date} の本文。kg は 20〜300 の 0.1 刻み
export function parseWeightInput(raw: unknown): { kg: number } {
  const kg = asObject(raw).kg;
  if (typeof kg !== 'number' || !Number.isFinite(kg) || kg < WEIGHT_MIN || kg > WEIGHT_MAX || !isTenth(kg)) {
    throw invalid([`kg: ${WEIGHT_MIN}〜${WEIGHT_MAX} の範囲で、0.1 刻みの数で入れてください`]);
  }
  return { kg };
}

// PUT /body/height の本文。heightCm は 100〜250 の 0.1 刻み。null で消す
export function parseHeightInput(raw: unknown): { heightCm: number | null } {
  const v = asObject(raw).heightCm;
  if (v === null) return { heightCm: null };
  if (typeof v !== 'number' || !Number.isFinite(v) || v < HEIGHT_MIN || v > HEIGHT_MAX || !isTenth(v)) {
    throw invalid([`heightCm: ${HEIGHT_MIN}〜${HEIGHT_MAX} の範囲で、0.1 刻みの数で入れてください（消すときは null）`]);
  }
  return { heightCm: v };
}

export type ProfileInput = { bio: string | null; favoriteKind: (typeof BODY_KINDS)[number] | null; activeTime: (typeof ACTIVE_TIMES)[number] | null };

// PUT /body/profile の本文。3つとも任意（null か省略で空にする）。ひとことは前後の空白を除いて 1〜40字（コードポイント）、空文字は null
export function parseProfileInput(raw: unknown): ProfileInput {
  const body = asObject(raw);
  const details: string[] = [];

  let bio: string | null = null;
  if (body.bio !== undefined && body.bio !== null) {
    if (typeof body.bio !== 'string') details.push('bio: 文字で入れてください');
    else {
      const t = body.bio.trim();
      if (Array.from(t).length > BIO_MAX) details.push(`bio: ${BIO_MAX}字までです`);
      else bio = t === '' ? null : t;
    }
  }

  const pick = <T extends string>(key: string, allowed: readonly T[]): T | null => {
    const v = body[key];
    if (v === undefined || v === null) return null;
    if (typeof v === 'string' && (allowed as readonly string[]).includes(v)) return v as T;
    details.push(`${key}: ${allowed.join('・')} のどれかにしてください`);
    return null;
  };
  const favoriteKind = pick('favoriteKind', BODY_KINDS);
  const activeTime = pick('activeTime', ACTIVE_TIMES);

  if (details.length > 0) throw invalid(details);
  return { bio, favoriteKind, activeTime };
}
