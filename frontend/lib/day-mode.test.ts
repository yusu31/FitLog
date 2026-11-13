import { dayDateOf, parseDayMode, recordedAtFor, withDay } from './day-mode';

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
