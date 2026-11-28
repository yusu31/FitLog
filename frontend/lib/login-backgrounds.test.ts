import { LOGIN_BACKGROUNDS, pickBackground } from '@/lib/login-backgrounds';

// ログインの背景の選び方（Issue #473）。絵は差し替え式で、初期は空
describe('pickBackground', () => {
  it('絵が無いときは null（今までの帯のまま）', () => {
    expect(pickBackground(0, null, null)).toBeNull();
    expect(LOGIN_BACKGROUNDS).toHaveLength(0);
  });

  it('?bg=番号 があればそれに固定。範囲外・数字でない値は無視してランダム', () => {
    expect(pickBackground(5, 1, '3')).toBe(3);
    expect(pickBackground(5, null, '9', () => 0)).toBe(0);
    expect(pickBackground(5, null, 'abc', () => 0)).toBe(0);
  });

  it('前回と同じ番号は続けて選ばない', () => {
    for (let r = 0; r < 1; r += 0.05) expect(pickBackground(5, 2, null, () => r)).not.toBe(2);
  });

  it('1枚だけなら前回が同じでもその1枚', () => {
    expect(pickBackground(1, 0, null)).toBe(0);
  });
});
