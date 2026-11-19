import { parseHeightInput, parseMeasuredOn, parseProfileInput, parseWeightInput } from './body-input.js';

const NOW = new Date('2026-11-19T03:00:00Z'); // 日本時間 11/19 12:00

describe('parseMeasuredOn', () => {
  it('今日（日本時間）は通り、明日は弾く', () => {
    expect(parseMeasuredOn('2026-11-19', NOW)).toBe('2026-11-19');
    expect(() => parseMeasuredOn('2026-11-20', NOW)).toThrow();
  });
  it('日本時間では翌日になる時刻（UTC 15:00）は、翌日が今日', () => {
    expect(parseMeasuredOn('2026-11-20', new Date('2026-11-19T15:00:00Z'))).toBe('2026-11-20');
  });
  it('実在しない日・形の違う日・2000年より前は弾く', () => {
    expect(() => parseMeasuredOn('2026-02-30', NOW)).toThrow();
    expect(() => parseMeasuredOn('2026/11/19', NOW)).toThrow();
    expect(() => parseMeasuredOn('1999-12-31', NOW)).toThrow();
    expect(parseMeasuredOn('2000-01-01', NOW)).toBe('2000-01-01');
  });
});

describe('parseWeightInput', () => {
  it('20 と 300 は通り、19.9 と 300.1 は弾く', () => {
    expect(parseWeightInput({ kg: 20 })).toEqual({ kg: 20 });
    expect(parseWeightInput({ kg: 300 })).toEqual({ kg: 300 });
    expect(() => parseWeightInput({ kg: 19.9 })).toThrow();
    expect(() => parseWeightInput({ kg: 300.1 })).toThrow();
  });
  it('0.1 刻みでない・数でないものは弾く', () => {
    expect(parseWeightInput({ kg: 70.1 })).toEqual({ kg: 70.1 });
    expect(() => parseWeightInput({ kg: 70.05 })).toThrow();
    expect(() => parseWeightInput({ kg: '70' })).toThrow();
    expect(() => parseWeightInput(null)).toThrow();
  });
});

describe('parseHeightInput', () => {
  it('100 と 250 は通り、99.9 と 250.1 は弾く。null は消す', () => {
    expect(parseHeightInput({ heightCm: 100 })).toEqual({ heightCm: 100 });
    expect(parseHeightInput({ heightCm: 250 })).toEqual({ heightCm: 250 });
    expect(parseHeightInput({ heightCm: null })).toEqual({ heightCm: null });
    expect(() => parseHeightInput({ heightCm: 99.9 })).toThrow();
    expect(() => parseHeightInput({ heightCm: 250.1 })).toThrow();
    expect(() => parseHeightInput({})).toThrow();
  });
});

describe('parseProfileInput', () => {
  it('ひとことは40字まで（コードポイント）。41字は弾く', () => {
    expect(parseProfileInput({ bio: 'あ'.repeat(40) }).bio).toBe('あ'.repeat(40));
    expect(() => parseProfileInput({ bio: 'あ'.repeat(41) })).toThrow();
    expect(parseProfileInput({ bio: '😀'.repeat(40) }).bio).toBe('😀'.repeat(40));
    expect(() => parseProfileInput({ bio: '😀'.repeat(41) })).toThrow();
  });
  it('空白だけ・省略は null', () => {
    expect(parseProfileInput({ bio: '   ' })).toEqual({ bio: null, favoriteKind: null, activeTime: null });
    expect(parseProfileInput({})).toEqual({ bio: null, favoriteKind: null, activeTime: null });
  });
  it('よくやる運動・時間帯は決まった値だけ', () => {
    expect(parseProfileInput({ favoriteKind: 'both', activeTime: 'night' })).toEqual({ bio: null, favoriteKind: 'both', activeTime: 'night' });
    expect(() => parseProfileInput({ favoriteKind: 'yoga' })).toThrow();
    expect(() => parseProfileInput({ activeTime: 'evening' })).toThrow();
  });
});
