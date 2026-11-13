import { describe, expect, it } from 'vitest';
import { ghostLegend } from './ghost-legend';

// 地図ゴースト（F-17）の凡例。前回のラン（日付・距離・ペース）を一言で。責める言い方・良し悪しの判定は入れない
describe('ghostLegend', () => {
  it('前回の日付（日本時間）・距離・ペースを出す', () => {
    // 2026-10-20 03:00Z＝日本時間 10/20 12:00。4200m・1800秒 → 7:09/km
    expect(ghostLegend({ recordedAt: '2026-10-20T03:00:00.000Z', distanceM: 4200, durationS: 1800 })).toBe('点線は前回（10/20・4.2km・7:09/km）');
  });
  it('日本時間で日付をまたぐ時刻でも日本時間の日付（UTC 10-19 16:00＝日本 10/20 1:00）', () => {
    expect(ghostLegend({ recordedAt: '2026-10-19T16:00:00.000Z', distanceM: 5000, durationS: 1500 })).toContain('10/20');
  });
  it('ペースが出せない壊れた値でも落ちず、ペースを省く', () => {
    expect(ghostLegend({ recordedAt: '2026-10-20T03:00:00.000Z', distanceM: 0, durationS: 600 })).toBe('点線は前回（10/20・0.0km）');
  });
  it('「遅い」「負け」など評価の言葉を含まない', () => {
    expect(ghostLegend({ recordedAt: '2026-10-20T03:00:00.000Z', distanceM: 4200, durationS: 1800 })).not.toMatch(/遅|負|勝|落ち/);
  });
});
