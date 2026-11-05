import { visibleUntilOf } from './video-expiry.js';

// 動画が仲間に見える期限（F-13・docs/database-design.md videos.visible_until）。
// 記録の週の日曜 24:00（日本時間）= 翌週の月曜 0:00（日本時間）。この瞬間以後は仲間に見せない
describe('visibleUntilOf（仲間に見える期限）', () => {
  it('週の途中（水曜の昼）の記録は、その週の日曜 24:00 JST', () => {
    // 2026-10-28 水曜 12:00 JST → 次の月曜 2026-11-02 0:00 JST = 2026-11-01T15:00:00Z
    expect(visibleUntilOf(new Date('2026-10-28T03:00:00Z')).toISOString()).toBe('2026-11-01T15:00:00.000Z');
  });

  it('月曜 0:00 ちょうど（JST）の記録は、その週の日曜 24:00 JST（週の始まりは前の週に入らない）', () => {
    // 2026-10-26 月曜 0:00 JST = 2026-10-25T15:00:00Z
    expect(visibleUntilOf(new Date('2026-10-25T15:00:00Z')).toISOString()).toBe('2026-11-01T15:00:00.000Z');
  });

  it('日曜の 23:59:59 JST の記録は、その 1 秒後が期限（同じ週）', () => {
    // 2026-11-01 日曜 23:59:59 JST = 2026-11-01T14:59:59Z
    expect(visibleUntilOf(new Date('2026-11-01T14:59:59Z')).toISOString()).toBe('2026-11-01T15:00:00.000Z');
  });

  it('日曜 24:00 ちょうど（= 月曜 0:00 JST）の記録は、次の週に入る', () => {
    expect(visibleUntilOf(new Date('2026-11-01T15:00:00Z')).toISOString()).toBe('2026-11-08T15:00:00.000Z');
  });

  it('UTC では前日でも、日本時間で日付を決める（UTC の日曜 20:00 は JST の月曜 5:00）', () => {
    // 2026-11-01T20:00:00Z = 2026-11-02 月曜 5:00 JST → 期限は 2026-11-09 月曜 0:00 JST
    expect(visibleUntilOf(new Date('2026-11-01T20:00:00Z')).toISOString()).toBe('2026-11-08T15:00:00.000Z');
  });
});
