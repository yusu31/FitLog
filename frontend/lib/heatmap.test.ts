import { BodyPart } from '@/lib/api/generated';
import { heatLevel, levelsOf } from './heatmap';

// docs/testing-design.md 3-10 T-HEAT-01〜04・07。境目は features.md 2.10（0／1〜2／3／4〜）
describe('heatLevel（今週のその部位のセット数 → 色の段階）', () => {
  it.each<[string, number, number]>([
    ['T-HEAT-01 0セットは色なし', 0, 0],
    ['T-HEAT-02 1セットは段階1（下端）', 1, 1],
    ['T-HEAT-03 2セットは段階1（上端）', 2, 1],
    ['T-HEAT-04 3セットは段階2（下端）', 3, 2],
    ['3セットの次の4セットは段階3（下端）', 4, 3],
    ['多いセットも最上段のまま', 30, 3],
  ])('%s', (_name, sets, level) => {
    expect(heatLevel(sets)).toBe(level);
  });
});

describe('levelsOf（T-HEAT-07 部位の一覧から作る）', () => {
  it('応答に無い部位は 0。部位の数を決め打ちしない（BodyPart の全値が入る）', () => {
    const levels = levelsOf([{ bodyPart: BodyPart.chest, sets: 3 }]);
    expect(Object.keys(levels).sort()).toEqual(Object.values(BodyPart).sort());
    expect(levels.chest).toBe(2);
    expect(levels.legs).toBe(0);
  });
});
