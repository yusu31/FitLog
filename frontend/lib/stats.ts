import type { StampKey, StatsCalendarDay, StatsResponse } from '@/lib/api/generated';
import { weekdayIndex } from '@/lib/format';
import { addDays, weekDates, weekStartOf, type CellStatus } from '@/lib/shared/week';

// 記録のまとめ（F-22 週・月・年／F-26 今月の数字／F-27 グラフ／F-29 スタンプ帳。docs/features.md 2.13）の画面側の純粋な関数。

export type StatsView = 'week' | 'month' | 'year';
export const STATS_VIEWS: ReadonlyArray<{ view: StatsView; label: string }> = [
  { view: 'week', label: '週' },
  { view: 'month', label: '月' },
  { view: 'year', label: '年' },
];

// 期間の数字（動いた日・おやすみ・総重量・ラン）。calendar の日ごとの値を足し合わせる。範囲は from〜to（今日まで・calendar の範囲内だけ）
export type Totals = { days: number; rest: number; kg: number; m: number };
export type Metric = 'days' | 'kg' | 'm';
export const METRICS: ReadonlyArray<{ key: Metric; label: string }> = [
  { key: 'days', label: '動いた日' },
  { key: 'kg', label: '総重量' },
  { key: 'm', label: 'ラン' },
];

export function sumRange(calendar: readonly StatsCalendarDay[], from: string, to: string): Totals {
  const t: Totals = { days: 0, rest: 0, kg: 0, m: 0 };
  for (const c of calendar) {
    if (c.date < from || c.date > to) continue;
    if (c.status === 'rec') t.days += 1;
    if (c.status === 'rest') t.rest += 1;
    t.kg += c.weightKg;
    t.m += c.runM;
  }
  t.kg = Math.round(t.kg * 10) / 10;
  return t;
}

const DAY_MS = 86_400_000;
const utc = (date: string): number => Date.parse(`${date}T00:00:00Z`);

// 週のずれ（0＝今週、-1＝先週）の月曜〜日曜
export function weekRange(today: string, off: number): { from: string; to: string } {
  const from = addDays(weekStartOf(today), off * 7);
  return { from, to: addDays(from, 6) };
}

// 月のずれ（0＝今月）の1日〜月末
export function monthRange(today: string, off: number): { from: string; to: string; ym: string } {
  const d = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1 + off, 1));
  const ym = d.toISOString().slice(0, 7);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
  return { from: `${ym}-01`, to: last, ym };
}

// さかのぼれる限界（calendar の最初の日を含む週・月まで）
export function minWeekOffset(today: string, firstDate: string): number {
  return -Math.round((utc(weekStartOf(today)) - utc(weekStartOf(firstDate))) / (7 * DAY_MS));
}
export function minMonthOffset(today: string, firstDate: string): number {
  return -((Number(today.slice(0, 4)) - Number(firstDate.slice(0, 4))) * 12 + Number(today.slice(5, 7)) - Number(firstDate.slice(5, 7)));
}

// 横に並べる6つのタイルの、先頭のずれ。選んだものを含み、右端は今（0）まで・左端は限界まで
export function tileWindowStart(off: number, min: number): number {
  return Math.max(min, Math.min(off - 2, -5));
}

// 数字タイルの表示値。単位は別に返し、画面で小さく出す
export function formatMetric(metric: Metric, v: number): { value: string; unit: string } {
  if (metric === 'days') return { value: String(v), unit: '日' };
  if (metric === 'kg') return v >= 1000 ? { value: (v / 1000).toFixed(1), unit: 't' } : { value: String(v), unit: 'kg' };
  return { value: (v / 1000).toFixed(1), unit: 'km' };
}

// 月のカレンダー（月曜始まり。先頭の空きは date が null）。今日より後の日は none
export type GridCell = { date: string | null; status: CellStatus };
export function monthGrid(calendar: readonly StatsCalendarDay[], today: string, off: number): GridCell[] {
  const { from, to } = monthRange(today, off);
  const statusOf = new Map(calendar.map((c) => [c.date, c.status]));
  const lead: GridCell[] = Array.from({ length: (weekdayIndex(from) + 6) % 7 }, () => ({ date: null, status: 'none' as CellStatus }));
  const days: GridCell[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) days.push({ date: d, status: d > today ? 'none' : (statusOf.get(d) ?? 'none') });
  return [...lead, ...days];
}

// 週の帯（月〜日の7マス）。今日より後の日は none。月・年と同じマス（GridCell）で並べる（D5-2）
export function weekGrid(calendar: readonly StatsCalendarDay[], today: string, off: number): GridCell[] {
  const statusOf = new Map(calendar.map((c) => [c.date, c.status]));
  return weekDates(weekRange(today, off).from).map((d) => ({ date: d, status: d > today ? 'none' : (statusOf.get(d) ?? 'none') }));
}

// 年（D5-2）: 月ごとの小さなカレンダー12個。off は「いちばん新しい月」のずれ（0＝今月が右下。◀で1か月ずつ前へ）。古い順に並べる
export type YearMonth = { ym: string; label: string; cells: GridCell[] };
export function yearMonths(calendar: readonly StatsCalendarDay[], today: string, off: number): YearMonth[] {
  return Array.from({ length: 12 }, (_, i) => {
    const o = off - 11 + i;
    const { ym } = monthRange(today, o);
    return { ym, label: `${Number(ym.slice(5))}月`, cells: monthGrid(calendar, today, o) };
  });
}
// 年の◀で戻れる限界。12か月の左端が calendar の最初の月になるところまで（0 を超えて先へは進めない）
export function minYearOffset(today: string, firstDate: string): number {
  return Math.min(0, minMonthOffset(today, firstDate) + 11);
}

// 祝福に重ねる「今月◯日目」（F-20）。今月動いた日数に、今日がまだ数えられていなければ今日の分を足す。
// 画面を開いた後に記録しても、同じ日の2回目以降でも、同じ数になる（今日が数え済みなら足さない）
export function monthDayCount(stats: Pick<StatsResponse, 'month' | 'calendar'>): number {
  const todayCounted = stats.calendar.at(-1)?.status === 'rec';
  return stats.month.activeDays + (todayCounted ? 0 : 1);
}

// 総重量を身近な物に換算した1行（F-26）。物の種類と重さは仮置き（お米の袋 10kg・軽自動車 1000kg）。10kg 未満は出さない
export function weightEquivalent(kg: number): string | null {
  if (kg >= 1000) return `軽自動車 ${Math.floor(kg / 1000)}台ぶん`;
  if (kg >= 10) return `お米の袋 ${Math.floor(kg / 10)}袋ぶん`;
  return null;
}

// スタンプ帳（F-29）の表示名。初めて・累計だけ。「あと◯」は出さない
export const STAMP_LABEL: Record<StampKey, string> = {
  'first-record': '初めての記録',
  'first-run': '初めてのラン',
  'first-5k': '初めての5km',
  'first-10k': '初めての10km',
  'days-10': '記録10日',
  'days-30': '記録30日',
  'days-100': '記録100日',
  'weight-1t': '総重量1t',
  'weight-10t': '総重量10t',
  'weight-100t': '総重量100t',
  'run-50k': '累計50km',
  'run-100k': '累計100km',
  'run-500k': '累計500km',
};

// 最近とった4つ（新しい順。同じ日は帳の並びの後ろのほうを先に）。まだ1つもなければ出さない
export function recentStamps(stamps: StatsResponse['stamps'], limit = 4): StatsResponse['stamps'] {
  return stamps
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => s.earned && s.earnedAt)
    .sort((x, y) => (y.s.earnedAt! === x.s.earnedAt! ? y.i - x.i : y.s.earnedAt! < x.s.earnedAt! ? -1 : 1))
    .slice(0, limit)
    .map(({ s }) => s);
}
