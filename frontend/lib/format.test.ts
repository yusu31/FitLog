import { formatJstTime, formatPace } from './format';

describe('formatPace（1kmあたりのペース）', () => {
  it.each([
    [5200, 1930, '6:11/km'], // 1930/5.2 = 371.15 → 四捨五入で 371秒
    [1000, 300, '5:00/km'], // ちょうど
    [100, 60, '10:00/km'], // 下限（0.1km・1分）
    [200000, 86400, '7:12/km'], // 上限（200km・24時間）
    [1000, 3659, '1:00:59/km'], // 1時間を超えるペースも崩れない
    [3000, 1199, '6:40/km'], // 399.67 → 400秒（秒の繰り上がり）
  ])('%im・%i秒 → %s', (d, t, expected) => {
    expect(formatPace(d, t)).toBe(expected);
  });

  it.each([
    [0, 600],
    [-100, 600],
    [1000, 0],
    [1000, -1],
    [Number.NaN, 600],
    [1000, Number.POSITIVE_INFINITY],
  ])('距離 %s・時間 %s は 0 割りなどになるので null', (d, t) => {
    expect(formatPace(d, t)).toBeNull();
  });
});

describe('formatJstTime（日本時間の時刻）', () => {
  it.each([
    ['2026-10-22T03:05:00.000Z', '12:05'],
    ['2026-10-22T14:59:00.000Z', '23:59'], // 日付が変わる直前
    ['2026-10-22T15:00:00.000Z', '0:00'], // 日付が変わった（翌日の 0:00）
    ['2026-10-22T00:00:00.000Z', '9:00'],
  ])('%s → %s', (iso, expected) => {
    expect(formatJstTime(iso)).toBe(expected);
  });
});
