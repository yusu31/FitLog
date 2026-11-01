import { compareSet, isPersonalBest, volumeOf } from './ghost.js';

// ゴーストの比べ方と自己ベストの判定（docs/testing-design.md 3-2。画面と API が使う共通の関数）。
const w = (weightKg: number, reps: number) => ({ weightKg, reps });

describe('compareSet（前回の同じセットと今回を比べる）', () => {
  it.each<[string, [number, number], [number, number], 'up' | 'same' | 'down']>([
    ['T-GHOST-02 重量が同じ・回数が多い', [40, 10], [40, 11], 'up'],
    ['T-GHOST-03 重量が同じ・回数も同じ', [40, 10], [40, 10], 'same'],
    ['T-GHOST-04 重量が同じ・回数が少ない', [40, 10], [40, 9], 'down'],
    ['T-GHOST-05 重量が違う・volume が大きい（400 → 405）', [40, 10], [45, 9], 'up'],
    ['T-GHOST-06 重量が違う・volume が同じ（400 → 400）', [40, 10], [50, 8], 'same'],
    ['T-GHOST-07 重量が違う・volume が小さい（400 → 360）', [40, 10], [45, 8], 'down'],
    ['T-GHOST-08 重量も回数も大きい（40×10 → 45×11）', [40, 10], [45, 11], 'up'],
    ['T-GHOST-09 軽くして回数を稼ぐ（400 → 420）は上回り（仕様どおり）', [40, 10], [30, 14], 'up'],
    ['T-GHOST-10 重量 0 同士は回数で比べる（回数が多い）', [0, 10], [0, 12], 'up'],
    ['T-GHOST-10 重量 0 同士は回数で比べる（回数が少ない）', [0, 10], [0, 8], 'down'],
    ['T-GHOST-10 重量 0 同士は回数で比べる（同じ）', [0, 10], [0, 10], 'same'],
    ['重量 0 と 重量あり（0 → 40×1）は volume で比べて上回り', [0, 10], [40, 1], 'up'],
  ])('%s', (_name, previous, current, expected) => {
    expect(compareSet(w(...previous), w(...current))).toBe(expected);
  });
});

describe('volumeOf（重量×回数）', () => {
  it('0.5 刻みでも誤差が出ない（22.5kg×3 = 67.5）', () => {
    expect(volumeOf(w(22.5, 3))).toBe(67.5);
  });
});

describe('isPersonalBest（過去最大の volume を超えたか）', () => {
  it('T-PB-01 過去が無い（その種目の初めての記録）は付けない', () => {
    expect(isPersonalBest(w(40, 10), null)).toBe(false);
  });
  it('T-PB-02 過去最大 360 に対し 361 は付ける', () => {
    expect(isPersonalBest(w(361, 1), 360)).toBe(true);
  });
  it('T-PB-03 過去最大 360 に対し 360 は付けない', () => {
    expect(isPersonalBest(w(45, 8), 360)).toBe(false);
  });
  it('T-PB-04 過去最大 360 に対し 359 は付けない', () => {
    expect(isPersonalBest(w(359, 1), 360)).toBe(false);
  });
});
