import type { StatsCalendarDay } from '@/lib/api/generated';
import { formatMetric, minMonthOffset, minWeekOffset, monthGrid, monthRange, monthDayCount, sumRange, tileWindowStart, weekRange, weightEquivalent, yearHeat } from './stats';

// 記録のまとめ（F-22・F-26・F-27。D5）の画面側の関数（docs/testing-design.md 3-14）。今日は 2026-11-12（木曜）。

function calendarEnding(today: string, over: Record<string, Partial<StatsCalendarDay>> = {}): StatsCalendarDay[] {
  const out: StatsCalendarDay[] = [];
  const end = new Date(`${today}T00:00:00Z`);
  for (let i = 364; i >= 0; i--) {
    const d = new Date(end);
    d.setUTCDate(end.getUTCDate() - i);
    const date = d.toISOString().slice(0, 10);
    out.push({ date, status: 'none', weightKg: 0, runM: 0, ...over[date] });
  }
  return out;
}

describe('weekRange・monthRange（期間のずれ）', () => {
  it('週: 0 は今週（月曜〜日曜）、-1 は先週', () => {
    expect(weekRange('2026-11-12', 0)).toEqual({ from: '2026-11-09', to: '2026-11-15' });
    expect(weekRange('2026-11-12', -1)).toEqual({ from: '2026-11-02', to: '2026-11-08' });
  });
  it('月: 0 は今月、-1 は先月。年をまたぐ・月末も正しい', () => {
    expect(monthRange('2026-11-12', 0)).toEqual({ from: '2026-11-01', to: '2026-11-30', ym: '2026-11' });
    expect(monthRange('2026-02-10', 0).to).toBe('2026-02-28');
    expect(monthRange('2026-01-05', -1)).toEqual({ from: '2025-12-01', to: '2025-12-31', ym: '2025-12' });
  });
  it('さかのぼれる限界は calendar の最初の日（2025-11-13）を含む週・月まで', () => {
    expect(minWeekOffset('2026-11-12', '2025-11-13')).toBe(-52);
    expect(minMonthOffset('2026-11-12', '2025-11-13')).toBe(-12);
  });
  it('タイルの先頭: 右端は今（0）まで、左端は限界まで、選んだものを含む', () => {
    expect(tileWindowStart(0, -51)).toBe(-5);
    expect(tileWindowStart(-20, -51)).toBe(-22);
    expect(tileWindowStart(-50, -51)).toBe(-51);
    expect(tileWindowStart(-3, -51)).toBe(-5);
  });
});

describe('sumRange（期間の数字）', () => {
  const cal = calendarEnding('2026-11-12', {
    '2026-11-09': { status: 'rec', weightKg: 800.04, runM: 0 },
    '2026-11-10': { status: 'rest' },
    '2026-11-11': { status: 'rec', weightKg: 400, runM: 5000 },
  });
  it('動いた日・おやすみ・総重量・ランを範囲の中だけ足す', () => {
    expect(sumRange(cal, '2026-11-09', '2026-11-12')).toEqual({ days: 2, rest: 1, kg: 1200, m: 5000 });
    expect(sumRange(cal, '2026-11-10', '2026-11-10')).toEqual({ days: 0, rest: 1, kg: 0, m: 0 });
  });
  it('範囲の外は数えない', () => {
    expect(sumRange(cal, '2026-11-12', '2026-11-12')).toEqual({ days: 0, rest: 0, kg: 0, m: 0 });
  });
});

describe('formatMetric（タイルの数字）', () => {
  it.each<[Parameters<typeof formatMetric>[0], number, string, string]>([
    ['days', 3, '3', '日'],
    ['kg', 800, '800', 'kg'],
    ['kg', 1200, '1.2', 't'],
    ['m', 5000, '5.0', 'km'],
  ])('%s %s', (metric, v, value, unit) => {
    expect(formatMetric(metric, v)).toEqual({ value, unit });
  });
});

describe('monthGrid（月のカレンダー）', () => {
  const cal = calendarEnding('2026-11-12', { '2026-11-10': { status: 'rest' }, '2026-11-11': { status: 'rec' } });

  it('1日が日曜（2026-11-01）なので、月曜始まりの先頭に6つの空きが入る。月末まで30日', () => {
    const cells = monthGrid(cal, '2026-11-12', 0);
    expect(cells.slice(0, 6).every((c) => c.date === null)).toBe(true);
    expect(cells[6].date).toBe('2026-11-01');
    expect(cells.filter((c) => c.date).length).toBe(30);
  });
  it('休みは rest のまま、今日より後は none', () => {
    const cells = monthGrid(cal, '2026-11-12', 0);
    expect(cells.find((c) => c.date === '2026-11-10')!.status).toBe('rest');
    expect(cells.find((c) => c.date === '2026-11-20')!.status).toBe('none');
  });
  it('月の1日が月曜なら空きは入らない（2026-06-01 は月曜）、前の月も出せる', () => {
    expect(monthGrid(calendarEnding('2026-06-15'), '2026-06-15', 0)[0].date).toBe('2026-06-01');
    expect(monthGrid(cal, '2026-11-12', -1).filter((c) => c.date).length).toBe(31);
  });
});

describe('yearHeat（年の色のマス）', () => {
  const cal = calendarEnding('2026-11-12', { '2026-11-10': { status: 'rest' } });
  const halves = yearHeat(cal);
  it('365日を半年ずつ2段に分ける（空きを除いて合計365）', () => {
    expect(halves).toHaveLength(2);
    expect(halves.flatMap((h) => h.cells).filter(Boolean)).toHaveLength(365);
    expect(halves[0].cells).toHaveLength(halves[0].cols * 7);
  });
  it('最初の日の曜日に合わせて先頭に空き（2025-11-13 は木曜＝3つ）、休みは rest', () => {
    expect(halves[0].cells.slice(0, 3).every((c) => c === null)).toBe(true);
    expect(halves[0].cells[3]!.date).toBe('2025-11-13');
    expect(halves[1].cells.find((c) => c?.date === '2026-11-10')!.status).toBe('rest');
  });
  it('月の1日がある列に月の見出しが付く', () => {
    const all = halves.flatMap((h) => h.labels.map((l) => l.text));
    expect(all).toEqual(['12月', '1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月']);
  });
});

describe('monthDayCount（祝福の「今月◯日目」。F-20）', () => {
  const month = (activeDays: number) => ({ month: '2026-11', activeDays, restDays: 0, totalWeightKg: 0, runDistanceM: 0 });
  const withToday = (status: StatsCalendarDay['status']) => calendarEnding('2026-11-12', { '2026-11-12': { status } });

  it('今日がまだ数えられていない（今日の最初の記録）なら、今月の日数に1日足す', () => {
    expect(monthDayCount({ month: month(3), calendar: withToday('none') })).toBe(4);
  });
  it('今日が数え済み（同じ日の2回目以降）なら足さない＝同じ数のまま', () => {
    expect(monthDayCount({ month: month(4), calendar: withToday('rec') })).toBe(4);
  });
  it('今月はじめての記録は 1 日目（境界: 0 日 → 1）', () => {
    expect(monthDayCount({ month: month(0), calendar: withToday('none') })).toBe(1);
  });
  it('今日が「おやすみ」だけの日でも、記録すれば足す（休みは動いた日に数えない）', () => {
    expect(monthDayCount({ month: month(2), calendar: withToday('rest') })).toBe(3);
  });
});

describe('weightEquivalent（総重量の換算。F-26）', () => {
  it.each<[number, string | null]>([
    [0, null],
    [9.9, null],
    [10, 'お米の袋 1袋ぶん'],
    [999.9, 'お米の袋 99袋ぶん'],
    [1000, '軽自動車 1台ぶん'],
    [3500, '軽自動車 3台ぶん'],
  ])('%skg → %s', (kg, expected) => {
    expect(weightEquivalent(kg)).toBe(expected);
  });
});
