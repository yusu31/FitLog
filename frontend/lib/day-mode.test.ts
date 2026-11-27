import { dayDateOf, dayModeOfDate, isLateDay, parseDayMode, recordedAtFor, selectableDates, withDay } from './day-mode';

describe('今日 / きのう の切り替え（F-21）', () => {
  it('?day=yesterday のときだけ きのう。それ以外（空・知らない値）は今日', () => {
    expect(parseDayMode('yesterday')).toBe('yesterday');
    expect(parseDayMode('today')).toBe('today');
    expect(parseDayMode(null)).toBe('today');
    expect(parseDayMode('tomorrow')).toBe('today');
  });

  it('きのうのときだけ、リンクに day=yesterday を足す（クエリがあれば & でつなぐ）', () => {
    expect(withDay('/run', 'today')).toBe('/run');
    expect(withDay('/run', 'yesterday')).toBe('/run?day=yesterday');
    expect(withDay('/record?exercise=abc', 'yesterday')).toBe('/record?exercise=abc&day=yesterday');
  });

  it('きのうの記録の日時は、きのう（日本時間）の12:00。今日は今の時刻', () => {
    const now = new Date('2026-11-13T00:30:00+09:00');
    expect(recordedAtFor('yesterday', now)).toBe('2026-11-12T03:00:00.000Z'); // 11/12 12:00 JST
    expect(recordedAtFor('today', now)).toBe(now.toISOString());
  });

  it('日本時間の0時すぎ（UTC ではまだ前日）でも、きのうは日本時間の前日（境界値）', () => {
    const justAfterMidnight = new Date('2026-11-13T00:00:00+09:00'); // UTC では 11/12 15:00
    expect(dayDateOf('yesterday', justAfterMidnight)).toBe('2026-11-12');
    expect(dayDateOf('today', justAfterMidnight)).toBe('2026-11-13');
    const justBeforeMidnight = new Date('2026-11-13T23:59:00+09:00');
    expect(dayDateOf('yesterday', justBeforeMidnight)).toBe('2026-11-12');
  });

  it('月の変わり目でも、きのうは前の月の末日', () => {
    expect(dayDateOf('yesterday', new Date('2026-12-01T09:00:00+09:00'))).toBe('2026-11-30');
  });
});

// 02-9 PR 2 ③: さかのぼれるのは今週（月曜〜今日）。今日は 2026-11-12（木）、今週の月曜は 11-09
describe('今週のさかのぼり（?day=YYYY-MM-DD）', () => {
  const now = new Date('2026-11-12T10:00:00+09:00');
  it('今週の過ぎた日の日付は、その日として受ける。きのうの日付は yesterday', () => {
    expect(parseDayMode('2026-11-09', now)).toBe('2026-11-09');
    expect(parseDayMode('2026-11-10', now)).toBe('2026-11-10');
    expect(parseDayMode('2026-11-11', now)).toBe('yesterday');
  });
  it('今日・先の日・先週・形が違う・実在しない日付は今日（範囲の外は受けない）', () => {
    for (const v of ['2026-11-12', '2026-11-13', '2026-11-08', '2026-11-9', '2026-02-30', '11-10']) expect(parseDayMode(v, now)).toBe('today');
  });
  it('今日が月曜なら、今週に過ぎた日は無い（きのう＝先週の日曜は yesterday だけ）', () => {
    const mon = new Date('2026-11-09T08:00:00+09:00');
    expect(parseDayMode('2026-11-08', mon)).toBe('yesterday');
    expect(parseDayMode('2026-11-07', mon)).toBe('today');
  });
  it('日付を選んだ日の日付・記録日時・リンクに使える', () => {
    expect(dayDateOf('2026-11-10', now)).toBe('2026-11-10');
    expect(recordedAtFor('2026-11-10', now)).toBe('2026-11-10T03:00:00.000Z'); // 11/10 12:00 JST
    expect(withDay('/run', '2026-11-10')).toBe('/run?day=2026-11-10');
    expect(withDay('/record?exercise=a', '2026-11-10')).toBe('/record?exercise=a&day=2026-11-10');
  });
  it('isLateDay: 今日以外は「あとから記録」', () => {
    expect(isLateDay('today')).toBe(false);
    expect(isLateDay('yesterday')).toBe(true);
    expect(isLateDay('2026-11-10')).toBe(true);
  });
  it('dayModeOfDate: 今日は today・きのうは yesterday・それ以外の今週の日はその日付', () => {
    expect(dayModeOfDate('2026-11-12', now)).toBe('today');
    expect(dayModeOfDate('2026-11-11', now)).toBe('yesterday');
    expect(dayModeOfDate('2026-11-09', now)).toBe('2026-11-09');
  });
  it('selectableDates: 今日・今週の過ぎた日・きのう（月曜は先週の日曜）', () => {
    expect(selectableDates(now)).toEqual(['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12']);
    expect(selectableDates(new Date('2026-11-09T08:00:00+09:00'))).toEqual(['2026-11-08', '2026-11-09']);
  });
});
