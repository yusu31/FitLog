import { hasShotThisWeek } from './video-gate.js';

// 仲間の動画を見る条件（案B・Issue #220）: 今週（日本時間の月曜 0:00〜日曜 24:00）に自分の動画が1本以上ある。
// 自分の動画の「見える期限（visible_until）」は記録の週の日曜 24:00 JST なので、今週の期限と同じものがあれば撮った週が今週
describe('hasShotThisWeek（今週、自分の動画が1本以上あるか）', () => {
  // 2026-11-04 水曜 12:00 JST。今週の期限は 2026-11-08 日曜 24:00 JST = 2026-11-08T15:00:00Z
  const WED = new Date('2026-11-04T03:00:00Z');
  const THIS_WEEK_END = new Date('2026-11-08T15:00:00Z');
  const LAST_WEEK_END = new Date('2026-11-01T15:00:00Z');

  it('動画が1本も無ければ false（同値分割: 空）', () => {
    expect(hasShotThisWeek(WED, [])).toBe(false);
  });

  it('今週の動画が1本あれば true', () => {
    expect(hasShotThisWeek(WED, [THIS_WEEK_END])).toBe(true);
  });

  it('先週の動画だけなら false（週が替わったらまた撮る）', () => {
    expect(hasShotThisWeek(WED, [LAST_WEEK_END])).toBe(false);
  });

  it('先週と今週が混ざっていれば true（1本でも今週があればよい）', () => {
    expect(hasShotThisWeek(WED, [LAST_WEEK_END, THIS_WEEK_END])).toBe(true);
  });

  it('日曜 23:59:59 JST（今週の最後の 1 秒）は、今週の動画が必要', () => {
    const lastSecond = new Date('2026-11-08T14:59:59Z');
    expect(hasShotThisWeek(lastSecond, [THIS_WEEK_END])).toBe(true);
    expect(hasShotThisWeek(lastSecond, [LAST_WEEK_END])).toBe(false);
  });

  it('月曜 0:00 JST ちょうどに週が替わり、先週に撮った分は数えない（境界値）', () => {
    const monday = new Date('2026-11-08T15:00:00Z');
    expect(hasShotThisWeek(monday, [THIS_WEEK_END])).toBe(false);
    expect(hasShotThisWeek(monday, [new Date('2026-11-15T15:00:00Z')])).toBe(true);
  });
});
