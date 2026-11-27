// 記録する日の切り替え（F-21 あとから記録。02-9 PR 2 ③ で「今週の過ぎた日」まで広げた。docs/features.md 2.14）。
// きのう以外の分は、画面の URL に ?day=YYYY-MM-DD（きのうは ?day=yesterday）を付けて運ぶ（静的書き出しなので、状態はクエリで持つ）。
// さかのぼれるのは今週（月曜〜今日）と、きのう（月曜のときは先週の日曜）。日付は日本時間。端末のタイムゾーンを使わない（lib/shared/local-date.ts）
import { toLocalDate } from '@/lib/shared/local-date';
import { WEEKDAYS, weekdayIndex } from '@/lib/format';
import { LATE_MESSAGES } from '@/lib/messages';
import { addDays, weekStartOf } from '@/lib/shared/week';

// 'today'・'yesterday'・今週の過ぎた日の日付（YYYY-MM-DD）
export type DayMode = 'today' | 'yesterday' | `${number}-${number}-${number}`;

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

const yesterdayOf = (now: Date): string => toLocalDate(new Date(now.getTime() - DAY_MS));

// URL の値から日を決める。範囲の外（今日・先の日・先週以前・形が違う・実在しない日付）は今日にする
export function parseDayMode(value: string | null | undefined, now: Date = new Date()): DayMode {
  if (value === 'yesterday') return 'yesterday';
  if (!value || !DATE.test(value)) return 'today';
  if (Number.isNaN(Date.parse(`${value}T00:00:00Z`)) || new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) return 'today';
  const today = toLocalDate(now);
  if (value >= today) return 'today';
  if (value === yesterdayOf(now)) return 'yesterday';
  return value >= weekStartOf(today) ? (value as DayMode) : 'today';
}

// 今日以外はすべて「あとから記録」
export const isLateDay = (day: DayMode): boolean => day !== 'today';

// 今日以外のときだけ、リンクに day=… を足す
export const withDay = (href: string, day: DayMode): string => (day === 'today' ? href : `${href}${href.includes('?') ? '&' : '?'}day=${day}`);

// その日（日本時間）の日付 YYYY-MM-DD
export const dayDateOf = (day: DayMode, now: Date): string => (day === 'today' ? toLocalDate(now) : day === 'yesterday' ? yesterdayOf(now) : day);

// API に送る recordedAt。今日以外は「その日の12:00（日本時間）」に決める（時刻は聞かない。並び順・週の集計は日付で足りる）
export const recordedAtFor = (day: DayMode, now: Date): string =>
  day === 'today' ? now.toISOString() : new Date(`${dayDateOf(day, now)}T12:00:00+09:00`).toISOString();

// 日付から日を決める（7マスのタップ用）。今日 → today・きのう → yesterday・それ以外はその日付
export function dayModeOfDate(date: string, now: Date): DayMode {
  if (date === toLocalDate(now)) return 'today';
  if (date === yesterdayOf(now)) return 'yesterday';
  return date as DayMode;
}

// 選べる日（古い順）: 今週の月曜〜今日と、きのう（月曜は先週の日曜）
export function selectableDates(now: Date): string[] {
  const today = toLocalDate(now);
  const yesterday = yesterdayOf(now);
  const out: string[] = [];
  for (let d = weekStartOf(today); d <= today; d = addDays(d, 1)) out.push(d);
  return out.includes(yesterday) ? out : [yesterday, ...out];
}

// 「11月10日（火）」の形（見出し・帯で共通）
export const dayLabel = (date: string): string => `${Number(date.slice(5, 7))}月${Number(date.slice(8, 10))}日（${WEEKDAYS[weekdayIndex(date)]}）`;

// 「あとから記録」の帯の文。きのうは今までの文、それ以外の日は日付つき
export const lateBannerText = (day: DayMode, now: Date): string => (day === 'yesterday' ? LATE_MESSAGES.banner : LATE_MESSAGES.bannerOn(dayLabel(dayDateOf(day, now))));
