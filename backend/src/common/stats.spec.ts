import { buildStats, STAMP_KEYS, type DayAgg } from './stats.js';

// 記録をくわしく（F-22・F-26・F-27・F-29。docs/testing-design.md 3-14）の集計。画面と API が使う純粋な関数。
// 2026-11-12 は木曜、2026-11-09 は月曜。

const day = (date: string, over: Partial<DayAgg> = {}): DayAgg => ({ date, status: 'rec', weightKg: 0, runM: 0, maxRunM: 0, ...over });
const earned = (days: DayAgg[], key: string): boolean => buildStats(days, '2026-11-12').stamps.find((s) => s.key === key)!.earned;

describe('calendar（1年分のマス）', () => {
  it('今日を最後に365日分が、日付の昇順で並ぶ', () => {
    const { calendar } = buildStats([], '2026-11-12');
    expect(calendar).toHaveLength(365);
    expect(calendar[364].date).toBe('2026-11-12');
    expect(calendar[0].date).toBe('2025-11-13');
  });
  it('記録のない日は none、記録した日は rec、休んだ日は rest（休みは欠けに見せず別の状態で返す）', () => {
    const { calendar } = buildStats([day('2026-11-10'), day('2026-11-11', { status: 'rest' })], '2026-11-12');
    const at = (d: string) => calendar.find((c) => c.date === d)!.status;
    expect([at('2026-11-10'), at('2026-11-11'), at('2026-11-12')]).toEqual(['rec', 'rest', 'none']);
  });
  it('範囲の外（365日前）の記録は入らない', () => {
    const { calendar } = buildStats([day('2025-11-12')], '2026-11-12');
    expect(calendar.every((c) => c.status === 'none')).toBe(true);
  });
});

describe('month（今月の数字。F-26）', () => {
  it('今月の動いた日・休んだ日・総重量・ラン距離を足し算で出す', () => {
    const { month } = buildStats(
      [
        day('2026-11-02', { weightKg: 1000.04 }),
        day('2026-11-05', { runM: 5000, maxRunM: 5000 }),
        day('2026-11-06', { status: 'rest' }),
        day('2026-11-09', { weightKg: 500 }),
      ],
      '2026-11-12',
    );
    expect(month).toEqual({ month: '2026-11', activeDays: 3, restDays: 1, totalWeightKg: 1500, runDistanceM: 5000 });
  });
  it('先月の記録は入らない（境界: 10-31 は先月・11-01 は今月）', () => {
    const { month } = buildStats([day('2026-10-31', { weightKg: 100 }), day('2026-11-01', { weightKg: 10 })], '2026-11-12');
    expect(month.activeDays).toBe(1);
    expect(month.totalWeightKg).toBe(10);
  });
  it('今日より後の日付は入らない', () => {
    expect(buildStats([day('2026-11-13')], '2026-11-12').month.activeDays).toBe(0);
  });
  it('何もなければすべて0', () => {
    expect(buildStats([], '2026-11-12').month).toEqual({ month: '2026-11', activeDays: 0, restDays: 0, totalWeightKg: 0, runDistanceM: 0 });
  });
});

describe('weekly（週ごとのグラフ。F-27）', () => {
  it('今週を最後に直近12週が、週の月曜の昇順で並ぶ', () => {
    const { weekly } = buildStats([], '2026-11-12');
    expect(weekly).toHaveLength(12);
    expect(weekly[11].weekStart).toBe('2026-11-09');
    expect(weekly[0].weekStart).toBe('2026-08-24');
  });
  it('日曜は前の週、月曜は新しい週に入る（境界）', () => {
    const { weekly } = buildStats([day('2026-11-08', { weightKg: 100 }), day('2026-11-09', { weightKg: 10, runM: 3000, maxRunM: 3000 })], '2026-11-12');
    expect(weekly[10]).toEqual({ weekStart: '2026-11-02', totalWeightKg: 100, runDistanceM: 0 });
    expect(weekly[11]).toEqual({ weekStart: '2026-11-09', totalWeightKg: 10, runDistanceM: 3000 });
  });
  it('13週前の記録は入らない', () => {
    const { weekly } = buildStats([day('2026-08-23', { weightKg: 999 })], '2026-11-12');
    expect(weekly.every((w) => w.totalWeightKg === 0)).toBe(true);
  });
});

describe('stamps（スタンプ帳。F-29。初めて・累計だけ）', () => {
  it('キーは固定の順で全部返る。何もなければ全部まだ', () => {
    const { stamps } = buildStats([], '2026-11-12');
    expect(stamps.map((s) => s.key)).toEqual([...STAMP_KEYS]);
    expect(stamps.every((s) => !s.earned)).toBe(true);
  });
  it('初めての記録・初めてのラン', () => {
    expect(earned([day('2026-11-01')], 'first-record')).toBe(true);
    expect(earned([day('2026-11-01')], 'first-run')).toBe(false);
    expect(earned([day('2026-11-01', { runM: 100, maxRunM: 100 })], 'first-run')).toBe(true);
  });
  it('休みだけでは記録のスタンプは増えない', () => {
    expect(earned([day('2026-11-01', { status: 'rest' })], 'first-record')).toBe(false);
  });
  it.each<[string, number, boolean]>([
    ['first-5k', 4999, false],
    ['first-5k', 5000, true],
    ['first-10k', 9999, false],
    ['first-10k', 10000, true],
  ])('%s は1回の距離 %dm で %s', (key, m, expected) => {
    expect(earned([day('2026-11-01', { runM: m, maxRunM: m })], key)).toBe(expected);
  });
  it('5km は1回の距離で決める（2回に分けた合計は数えない）', () => {
    expect(earned([day('2026-11-01', { runM: 6000, maxRunM: 3000 })], 'first-5k')).toBe(false);
  });
  it.each<[number, boolean]>([[9, false], [10, true]])('記録日数 %d 日で days-10 は %s', (n, expected) => {
    const days = Array.from({ length: n }, (_, i) => day(`2026-10-${String(i + 1).padStart(2, '0')}`));
    expect(earned(days, 'days-10')).toBe(expected);
  });
  it.each<[number, boolean]>([[999.9, false], [1000, true]])('累計 %skg で weight-1t は %s', (kg, expected) => {
    expect(earned([day('2026-11-01', { weightKg: kg })], 'weight-1t')).toBe(expected);
  });
  it.each<[number, boolean]>([[49999, false], [50000, true]])('累計ラン %dm で run-50k は %s', (m, expected) => {
    expect(earned([day('2026-11-01', { runM: m, maxRunM: m })], 'run-50k')).toBe(expected);
  });
  it('1年より前の記録も累計に入る（範囲はマスだけ）', () => {
    expect(earned([day('2020-01-01', { weightKg: 1000 })], 'weight-1t')).toBe(true);
  });
});
