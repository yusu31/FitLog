import type { StampKey, StatsCalendarDay, StatsResponse } from '@/lib/api/generated';
import { weekdayIndex } from '@/lib/format';
import { weekDates, weekStartOf, type CellStatus } from '@/lib/shared/week';

// 記録をくわしく（F-22 週・月・年／F-26 今月の数字／F-27 グラフ／F-29 スタンプ帳。docs/features.md 2.13）の画面側の純粋な関数。

export type StatsView = 'week' | 'month' | 'year';
export const STATS_VIEWS: ReadonlyArray<{ view: StatsView; label: string }> = [
  { view: 'week', label: '週' },
  { view: 'month', label: '月' },
  { view: 'year', label: '年' },
];

// date が null のマスは、月の最初の週の前の空き（見えない枠）
export type GridCell = { date: string | null; status: CellStatus };

// 週・月・年のマス（F-22）。休みの色は全期間で同じにする（状態をそのまま渡す）。今日より後の日は、状態が何であっても none（まだ記録できない日）。
// 週・月は月曜始まりの7列（上から下へ行を進める）。年は縦7段（月〜日）で、左から右へ週を進める
export function buildGrid(view: StatsView, calendar: readonly StatsCalendarDay[], today: string): GridCell[] {
  const statusOf = new Map(calendar.map((c) => [c.date, c.status]));
  const cell = (date: string): GridCell => ({ date, status: date > today ? 'none' : (statusOf.get(date) ?? 'none') });
  const lead = (first: string): GridCell[] => Array.from({ length: (weekdayIndex(first) + 6) % 7 }, () => ({ date: null, status: 'none' as CellStatus }));

  if (view === 'week') return weekDates(weekStartOf(today)).map(cell);
  if (view === 'month') {
    const first = `${today.slice(0, 7)}-01`;
    const days: GridCell[] = [];
    for (let d = new Date(`${first}T00:00:00Z`); d.toISOString().slice(0, 7) === today.slice(0, 7); d.setUTCDate(d.getUTCDate() + 1)) {
      days.push(cell(d.toISOString().slice(0, 10)));
    }
    return [...lead(first), ...days];
  }
  return [...lead(calendar[0].date), ...calendar.map((c) => cell(c.date))];
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

// 棒グラフの棒の高さ（0〜1）。最大値が 0 のときはすべて 0。0 でない値は、見えるよう最低 0.04 にする
export function barRatios(values: readonly number[]): number[] {
  const max = Math.max(0, ...values);
  return values.map((v) => (max === 0 || v <= 0 ? 0 : Math.max(0.04, v / max)));
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
