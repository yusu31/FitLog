import { describe, expect, it } from 'vitest';
import {
  DISTANCE_M_MAX,
  DISTANCE_M_MIN,
  DURATION_S_MAX,
  DURATION_S_MIN,
  formatPace,
  kmToMeters,
  minSecToSeconds,
  paceSecPerKm,
  parseKm,
  parseWholeNumber,
  validateRun,
} from './run';

// ラン（F-04・UC-09）の変換と検査。境界値は docs/testing-design.md の T-RUN-01〜08 と同じ
describe('kmToMeters（km → m）', () => {
  it.each([
    [0.1, 100],
    [5.2, 5200],
    [200, 200000],
    [0.3, 300], // 0.3 * 1000 は 300.00000000000006 になる。丸めて整数にする
    [1.005, 1005],
    [10.15, 10150],
  ])('%s km は %s m', (km, m) => {
    expect(kmToMeters(km)).toBe(m);
  });
});

describe('minSecToSeconds（分・秒 → 秒）', () => {
  it.each([
    [0, 59, 59],
    [1, 0, 60],
    [32, 10, 1930],
    [1440, 0, 86400],
  ])('%s 分 %s 秒は %s 秒', (m, s, total) => {
    expect(minSecToSeconds(m, s)).toBe(total);
  });
});

describe('parseKm（入力の文字 → km）', () => {
  it.each([
    ['5.2', 5.2],
    ['0.1', 0.1],
    [' 10 ', 10],
    ['5,2', 5.2], // カンマ区切りで打つ人もいる
    ['５．２', 5.2], // 全角
  ])('「%s」は %s', (text, km) => {
    expect(parseKm(text)).toBe(km);
  });
  it.each([[''], ['abc'], ['-1'], ['1e3'], ['5.2.1'], ['  ']])('「%s」は数として読めない（NaN）', (text) => {
    expect(parseKm(text)).toBeNaN();
  });
});

describe('parseWholeNumber（分・秒の入力 → 整数）', () => {
  it('空欄は 0（分だけ・秒だけ入れる人がいる）', () => {
    expect(parseWholeNumber('')).toBe(0);
    expect(parseWholeNumber('  ')).toBe(0);
  });
  it('整数はそのまま。全角も読む', () => {
    expect(parseWholeNumber('32')).toBe(32);
    expect(parseWholeNumber('３２')).toBe(32);
  });
  it.each([['1.5'], ['-3'], ['abc']])('「%s」は NaN', (text) => {
    expect(parseWholeNumber(text)).toBeNaN();
  });
});

describe('validateRun（T-RUN-01〜08 の境界値）', () => {
  it('範囲の定数は API の仕様と同じ', () => {
    expect([DISTANCE_M_MIN, DISTANCE_M_MAX, DURATION_S_MIN, DURATION_S_MAX]).toEqual([100, 200000, 60, 86400]);
  });
  it.each([
    [99, 'distance'],
    [100, null],
    [200000, null],
    [200001, 'distance'],
  ])('距離 %s m → %s', (distanceM, error) => {
    expect(validateRun(distanceM, 1800)).toBe(error);
  });
  it.each([
    [59, 'duration'],
    [60, null],
    [86400, null],
    [86401, 'duration'],
  ])('時間 %s 秒 → %s', (durationS, error) => {
    expect(validateRun(5000, durationS)).toBe(error);
  });
  it('数でない値（NaN）は、それぞれのエラー', () => {
    expect(validateRun(NaN, 1800)).toBe('distance');
    expect(validateRun(5000, NaN)).toBe('duration');
  });
  it('距離も時間も範囲の外なら、先に距離を返す', () => {
    expect(validateRun(99, 59)).toBe('distance');
  });
});

describe('ペース（分/km）。DB には持たず、画面が計算する', () => {
  it.each([
    [5000, 1500, 300], // 5km を 25分 → 5:00/km
    [5200, 1930, 371], // 1930 / 5.2 = 371.15
    [1000, 360, 360],
    [200000, 86400, 432], // 200km を 24時間 → 7:12/km
  ])('%s m を %s 秒 → %s 秒/km', (m, s, pace) => {
    expect(paceSecPerKm(m, s)).toBe(pace);
  });
  it('距離が 0 以下なら計算しない（null）', () => {
    expect(paceSecPerKm(0, 600)).toBeNull();
  });
  it.each([
    [300, "5'00\"/km"],
    [371, "6'11\"/km"],
    [3599, "59'59\"/km"],
    [3600, "60'00\"/km"],
  ])('%s 秒/km は %s', (sec, text) => {
    expect(formatPace(sec)).toBe(text);
  });
});
