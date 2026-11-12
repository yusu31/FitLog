// 記録をくわしく（F-22 週・月・年／F-26 今月の数字／F-27 グラフ／F-29 スタンプ帳。docs/testing-design.md 3-14）の集計。
// 画面と API が同じ結果を出す「共通の関数」。純粋な関数だけを置く（DB・Nest に依存しない）。日付は日本時間の日付（YYYY-MM-DD）の文字列。
import { addDays, weekStartOf, type CellStatus } from './week.js';

// 1日分の集計（DB の行を日付ごとにまとめたもの）。maxRunM はその日のランのうち一番長い1回の距離
export type DayAgg = { date: string; status: CellStatus; weightKg: number; runM: number; maxRunM: number };

export const CALENDAR_DAYS = 365;
export const WEEKLY_WEEKS = 12;

// スタンプの一覧と並び。初めて・累計だけで増える（連続・週◯回の型は作らない。requirements.md F-29）
export const STAMP_KEYS = [
  'first-record', 'first-run', 'first-5k', 'first-10k',
  'days-10', 'days-30', 'days-100',
  'weight-1t', 'weight-10t', 'weight-100t',
  'run-50k', 'run-100k', 'run-500k',
] as const;
export type StampKey = (typeof STAMP_KEYS)[number];

export type StatsResult = {
  today: string;
  calendar: { date: string; status: CellStatus }[];
  month: { month: string; activeDays: number; restDays: number; totalWeightKg: number; runDistanceM: number };
  weekly: { weekStart: string; totalWeightKg: number; runDistanceM: number }[];
  stamps: { key: StampKey; earned: boolean }[];
};

const round1 = (n: number): number => Math.round(n * 10) / 10;

export function buildStats(days: readonly DayAgg[], today: string): StatsResult {
  const byDate = new Map(days.map((d) => [d.date, d]));

  const calendar = Array.from({ length: CALENDAR_DAYS }, (_, i) => {
    const date = addDays(today, i - (CALENDAR_DAYS - 1));
    return { date, status: byDate.get(date)?.status ?? ('none' as CellStatus) };
  });

  const monthKey = today.slice(0, 7);
  const inMonth = days.filter((d) => d.date.startsWith(monthKey) && d.date <= today);
  const month = {
    month: monthKey,
    activeDays: inMonth.filter((d) => d.status === 'rec').length,
    restDays: inMonth.filter((d) => d.status === 'rest').length,
    totalWeightKg: round1(inMonth.reduce((sum, d) => sum + d.weightKg, 0)),
    runDistanceM: inMonth.reduce((sum, d) => sum + d.runM, 0),
  };

  const thisWeek = weekStartOf(today);
  const weekly = Array.from({ length: WEEKLY_WEEKS }, (_, i) => {
    const weekStart = addDays(thisWeek, (i - (WEEKLY_WEEKS - 1)) * 7);
    const end = addDays(weekStart, 6);
    const inWeek = days.filter((d) => d.date >= weekStart && d.date <= end);
    return {
      weekStart,
      totalWeightKg: round1(inWeek.reduce((sum, d) => sum + d.weightKg, 0)),
      runDistanceM: inWeek.reduce((sum, d) => sum + d.runM, 0),
    };
  });

  // スタンプは全期間（1年より前も数える）。今日より後の日付は数えない
  const upToToday = days.filter((d) => d.date <= today);
  const recDays = upToToday.filter((d) => d.status === 'rec').length;
  const totalWeight = upToToday.reduce((sum, d) => sum + d.weightKg, 0);
  const totalRun = upToToday.reduce((sum, d) => sum + d.runM, 0);
  const maxRun = Math.max(0, ...upToToday.map((d) => d.maxRunM));
  const rules: Record<StampKey, boolean> = {
    'first-record': recDays >= 1,
    'first-run': totalRun > 0,
    'first-5k': maxRun >= 5000,
    'first-10k': maxRun >= 10000,
    'days-10': recDays >= 10,
    'days-30': recDays >= 30,
    'days-100': recDays >= 100,
    'weight-1t': totalWeight >= 1000,
    'weight-10t': totalWeight >= 10000,
    'weight-100t': totalWeight >= 100000,
    'run-50k': totalRun >= 50000,
    'run-100k': totalRun >= 100000,
    'run-500k': totalRun >= 500000,
  };

  return { today, calendar, month, weekly, stamps: STAMP_KEYS.map((key) => ({ key, earned: rules[key] })) };
}
