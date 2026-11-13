// 「今日 / きのう」の切り替え（F-21 あとから記録。docs/features.md 2.x）。
// きのうの分は、画面の URL に ?day=yesterday を付けて運ぶ（静的書き出しなので、状態はクエリで持つ）。
// 日付は日本時間。端末のタイムゾーンを使わない（lib/shared/local-date.ts）
import { toLocalDate } from '@/lib/shared/local-date';

export type DayMode = 'today' | 'yesterday';

const DAY_MS = 24 * 60 * 60 * 1000;

export const parseDayMode = (value: string | null | undefined): DayMode => (value === 'yesterday' ? 'yesterday' : 'today');

// きのうのときだけ、リンクに day=yesterday を足す
export const withDay = (href: string, day: DayMode): string =>
  day === 'yesterday' ? `${href}${href.includes('?') ? '&' : '?'}day=yesterday` : href;

// その日（日本時間）の日付 YYYY-MM-DD
export const dayDateOf = (day: DayMode, now: Date): string => toLocalDate(day === 'yesterday' ? new Date(now.getTime() - DAY_MS) : now);

// API に送る recordedAt。きのうは「きのうの12:00（日本時間）」に決める（時刻は聞かない。並び順・週の集計は日付で足りる）
export const recordedAtFor = (day: DayMode, now: Date): string =>
  day === 'yesterday' ? new Date(`${dayDateOf('yesterday', now)}T12:00:00+09:00`).toISOString() : now.toISOString();
