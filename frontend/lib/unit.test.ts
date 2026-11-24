import { fromUnit, stepLb, toUnit } from './unit';

describe('重さの単位', () => {
  it('kg はそのまま、lb は小数1桁に直す', () => {
    expect(toUnit(60, 'kg')).toBe(60);
    expect(toUnit(60, 'lb')).toBe(132.3);
    expect(toUnit(0, 'lb')).toBe(0);
  });

  it('lb から kg へは 0.1 刻みに直す（135lb → 61.2kg）', () => {
    expect(fromUnit(135, 'lb')).toBe(61.2);
    expect(fromUnit(61.2, 'kg')).toBe(61.2);
  });

  it('5lb 刻みで動かす。5 の倍数の近く（0.5kg の丸めのずれ）からは、その倍数の次へ', () => {
    expect(stepLb(40, 1)).toBe(90); // 88.2lb → 90
    expect(stepLb(40, -1)).toBe(85);
    expect(stepLb(20.5, 1)).toBe(50); // 45.19lb（45lb のつもり）→ 50
    expect(stepLb(20.5, -1)).toBe(40);
    expect(stepLb(0, -1)).toBe(0); // 0 の下へは行かない
  });

  it('25lb 刻みでも同じ決まりで動く', () => {
    expect(stepLb(61, 1, 25)).toBe(150); // 134.5lb → 125 の近くではない → 150
    expect(stepLb(61, -1, 25)).toBe(125);
  });
});
