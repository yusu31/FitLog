import { daysBetween, shouldWelcomeBack } from './welcome-back';

// おかえり判定（docs/testing-design.md T-DATE-12・14、features.md UC-11）。日付は日本時間の YYYY-MM-DD。
describe('daysBetween（日付の差）', () => {
  it.each<[string, string, string, number]>([
    ['同じ日は 0', '2026-10-26', '2026-10-26', 0],
    ['翌日は 1', '2026-10-26', '2026-10-27', 1],
    ['月またぎ', '2026-10-30', '2026-11-02', 3],
    ['年またぎ', '2026-12-31', '2027-01-01', 1],
    ['うるう日をまたぐ', '2028-02-28', '2028-03-01', 2],
  ])('%s', (_n, from, to, expected) => {
    expect(daysBetween(from, to)).toBe(expected);
  });
});

describe('shouldWelcomeBack（最後の記録の日と今日の差が3日以上で祝う）', () => {
  it.each<[string, string | null, string, boolean]>([
    ['T-DATE-12 差が2日は祝わない（月曜に記録・水曜に開く）', '2026-10-26', '2026-10-28', false],
    ['T-DATE-12 差が3日は祝う（月曜に記録・木曜に開く）', '2026-10-26', '2026-10-29', true],
    ['T-DATE-12 差が4日も祝う', '2026-10-26', '2026-10-30', true],
    ['差が0日（今日すでに記録）は祝わない', '2026-10-26', '2026-10-26', false],
    ['差が1日は祝わない', '2026-10-26', '2026-10-27', false],
    ['記録がまだ無い人（初回）は祝わない', null, '2026-10-26', false],
    ['月またぎでも差で数える（10/30 → 11/2 は3日）', '2026-10-30', '2026-11-02', true],
  ])('%s', (_n, last, today, expected) => {
    expect(shouldWelcomeBack(last, today)).toBe(expected);
  });

  // T-DATE-14: 休みは記録に数える。呼び出し側は「最後の記録」に休みも含めた最新の日付を渡す
  it('T-DATE-14 月曜に記録・火曜に休み・木曜に記録: 最後の記録（火曜の休み）との差は2日で祝わない', () => {
    const lastRecordOrRest = '2026-10-27'; // 火曜の休み
    expect(shouldWelcomeBack(lastRecordOrRest, '2026-10-29')).toBe(false);
  });
});
