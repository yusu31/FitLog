import { beatsPast, milestoneOf } from './achievements.js';

describe('milestoneOf（運動した日数の節目: 1・7・30・100日目）', () => {
  const days = (n: number) => Array.from({ length: n }, (_, i) => `2026-01-${String(i + 1).padStart(2, '0')}`);

  it('1日目・7日目は節目', () => {
    expect(milestoneOf(days(7), '2026-01-01')).toBe(1);
    expect(milestoneOf(days(7), '2026-01-07')).toBe(7);
  });
  it('節目でない日は undefined', () => {
    expect(milestoneOf(days(7), '2026-01-02')).toBeUndefined();
    expect(milestoneOf(days(9), '2026-01-08')).toBeUndefined();
  });
  it('運動した日でなければ undefined', () => {
    expect(milestoneOf(days(7), '2026-02-01')).toBeUndefined();
  });
  it('同じ日が重なっても1回と数える', () => {
    expect(milestoneOf(['2026-01-02', '2026-01-02', '2026-01-01'], '2026-01-02')).toBeUndefined();
  });
  it('順番が入れ替わっていても日付順で数える', () => {
    expect(milestoneOf(['2026-01-05', '2026-01-01'], '2026-01-01')).toBe(1);
  });
});

describe('beatsPast（自己ベスト）', () => {
  it('過去の最大を超えたら true', () => expect(beatsPast(500, 480)).toBe(true));
  it('同じは false', () => expect(beatsPast(480, 480)).toBe(false));
  it('下回れば false', () => expect(beatsPast(400, 480)).toBe(false));
  it('過去が無い（初めて）は false', () => expect(beatsPast(500, null)).toBe(false));
});
