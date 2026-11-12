import type { StatsCalendarDay } from '@/lib/api/generated';
import { barRatios, buildGrid, monthDayCount, weightEquivalent } from './stats';

// 記録をくわしく（F-22・F-26・F-27）の画面側の関数（docs/testing-design.md 3-14）。今日は 2026-11-12（木曜）。

function calendarEnding(today: string, status: Record<string, StatsCalendarDay['status']> = {}): StatsCalendarDay[] {
  const out: StatsCalendarDay[] = [];
  const end = new Date(`${today}T00:00:00Z`);
  for (let i = 364; i >= 0; i--) {
    const d = new Date(end);
    d.setUTCDate(end.getUTCDate() - i);
    const date = d.toISOString().slice(0, 10);
    out.push({ date, status: status[date] ?? 'none' });
  }
  return out;
}

describe('buildGrid（週・月・年のマス）', () => {
  const cal = calendarEnding('2026-11-12', { '2026-11-10': 'rest', '2026-11-11': 'rec' });

  it('週は今週の月曜〜日曜の7マス。休みの色は rest のまま、今日より後は none', () => {
    const cells = buildGrid('week', cal, '2026-11-12');
    expect(cells.map((c) => c.date)).toEqual(['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15']);
    expect(cells.map((c) => c.status)).toEqual(['none', 'rest', 'rec', 'none', 'none', 'none', 'none']);
  });

  it('月は1日から月末まで。1日が日曜（2026-11-01）なので、月曜始まりの先頭に6つの空きが入る', () => {
    const cells = buildGrid('month', cal, '2026-11-12');
    expect(cells.slice(0, 6).every((c) => c.date === null)).toBe(true);
    expect(cells[6].date).toBe('2026-11-01');
    expect(cells.filter((c) => c.date).length).toBe(30);
    expect(cells.at(-1)!.date).toBe('2026-11-30');
  });

  it('月の1日が月曜なら空きは入らない（2026-06-01 は月曜）', () => {
    const cells = buildGrid('month', calendarEnding('2026-06-15'), '2026-06-15');
    expect(cells[0].date).toBe('2026-06-01');
  });

  it('年は365日分。最初の日の曜日に合わせて先頭に空きが入る（2025-11-13 は木曜＝3つ）', () => {
    const cells = buildGrid('year', cal, '2026-11-12');
    expect(cells.filter((c) => c.date).length).toBe(365);
    expect(cells.slice(0, 3).every((c) => c.date === null)).toBe(true);
    expect(cells[3].date).toBe('2025-11-13');
  });

  it('休みは週・月・年のどれでも同じ rest（欠けに見せない）', () => {
    for (const view of ['week', 'month', 'year'] as const) {
      expect(buildGrid(view, cal, '2026-11-12').find((c) => c.date === '2026-11-10')!.status).toBe('rest');
    }
  });
});

describe('monthDayCount（祝福の「今月◯日目」。F-20）', () => {
  const month = (activeDays: number) => ({ month: '2026-11', activeDays, restDays: 0, totalWeightKg: 0, runDistanceM: 0 });
  const withToday = (status: StatsCalendarDay['status']) => calendarEnding('2026-11-12', { '2026-11-12': status });

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

describe('barRatios（棒の高さ。F-27）', () => {
  it('最大が 1・0 は 0。全部 0 なら全部 0', () => {
    expect(barRatios([0, 50, 100])).toEqual([0, 0.5, 1]);
    expect(barRatios([0, 0])).toEqual([0, 0]);
  });
  it('極端に小さい値も見えるよう、最低 0.04 にする（境界: 0 は 0・0.001 は 0.04）', () => {
    expect(barRatios([0.1, 100000])[0]).toBe(0.04);
    expect(barRatios([0, 100000])[0]).toBe(0);
  });
});
