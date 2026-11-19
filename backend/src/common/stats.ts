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

// 期間（週・月・年）の数字。週・月・年の切替に合わせて画面が見せる（A08-5）
export type PeriodNumbers = { activeDays: number; restDays: number; totalWeightKg: number; runDistanceM: number };

export type StatsResult = {
  today: string;
  calendar: { date: string; status: CellStatus }[];
  week: PeriodNumbers; // 今週（月曜〜今日）
  month: { month: string } & PeriodNumbers; // 今月（1日〜今日）
  year: PeriodNumbers; // calendar と同じ365日
  weekly: { weekStart: string; totalWeightKg: number; runDistanceM: number }[];
  stamps: { key: StampKey; earned: boolean; earnedAt: string | null }[]; // earnedAt＝初めて条件を満たした記録の日（未獲得は null）
  totalRunDistanceM: number; // 全期間の累計ラン距離（F-28 日本縦断）
};

const round1 = (n: number): number => Math.round(n * 10) / 10;

export function buildStats(days: readonly DayAgg[], today: string): StatsResult {
  const byDate = new Map(days.map((d) => [d.date, d]));

  const calendar = Array.from({ length: CALENDAR_DAYS }, (_, i) => {
    const date = addDays(today, i - (CALENDAR_DAYS - 1));
    return { date, status: byDate.get(date)?.status ?? ('none' as CellStatus) };
  });

  // from〜today の日だけを足し合わせる（今日より後は数えない）
  const numbersOf = (from: string): PeriodNumbers => {
    const inRange = days.filter((d) => d.date >= from && d.date <= today);
    return {
      activeDays: inRange.filter((d) => d.status === 'rec').length,
      restDays: inRange.filter((d) => d.status === 'rest').length,
      totalWeightKg: round1(inRange.reduce((sum, d) => sum + d.weightKg, 0)),
      runDistanceM: inRange.reduce((sum, d) => sum + d.runM, 0),
    };
  };
  const monthKey = today.slice(0, 7);
  const month = { month: monthKey, ...numbersOf(`${monthKey}-01`) };
  const week = numbersOf(weekStartOf(today));
  const year = numbersOf(calendar[0].date);

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

  // スタンプは全期間（1年より前も数える）。今日より後の日付は数えない。
  // 日付の古い順に累計を進め、各スタンプが初めて条件を満たした日を earnedAt にする（U10）
  const upToToday = days.filter((d) => d.date <= today).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  let recDays = 0;
  let totalWeight = 0;
  let totalRun = 0;
  let maxRun = 0;
  const earnedAt = new Map<StampKey, string>();
  for (const d of upToToday) {
    if (d.status === 'rec') recDays += 1;
    totalWeight += d.weightKg;
    totalRun += d.runM;
    maxRun = Math.max(maxRun, d.maxRunM);
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
    for (const key of STAMP_KEYS) if (rules[key] && !earnedAt.has(key)) earnedAt.set(key, d.date);
  }

  return { today, calendar, week, month, year, weekly, stamps: STAMP_KEYS.map((key) => ({ key, earned: earnedAt.has(key), earnedAt: earnedAt.get(key) ?? null })), totalRunDistanceM: totalRun };
}
