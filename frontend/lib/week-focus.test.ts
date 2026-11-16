import { isRunHeavyWeek } from './week-focus';

const rec = (kind: 'workout' | 'run' | 'rest', localDate: string) => ({ kind, localDate });
const TODAY = '2026-11-18'; // 水曜。今週＝11/16（月）〜11/22（日）

describe('isRunHeavyWeek（今週ランが筋トレより多い人か。N9）', () => {
  it('ラン2件・筋トレ1件ならランが多い', () => {
    expect(isRunHeavyWeek([rec('run', '2026-11-17'), rec('run', '2026-11-16'), rec('workout', '2026-11-18')], TODAY)).toBe(true);
  });
  it('同数なら今の並びのまま（false）', () => {
    expect(isRunHeavyWeek([rec('run', '2026-11-17'), rec('workout', '2026-11-18')], TODAY)).toBe(false);
  });
  it('筋トレが多ければ false', () => {
    expect(isRunHeavyWeek([rec('run', '2026-11-17'), rec('workout', '2026-11-16'), rec('workout', '2026-11-18')], TODAY)).toBe(false);
  });
  it('どちらも0なら false（記録が無い人は今の並び）', () => {
    expect(isRunHeavyWeek([], TODAY)).toBe(false);
    expect(isRunHeavyWeek([rec('rest', '2026-11-17')], TODAY)).toBe(false);
  });
  it('先週（日曜 11/15）と来週の記録は数えない。週の境目は月曜（境界値）', () => {
    expect(isRunHeavyWeek([rec('run', '2026-11-15'), rec('run', '2026-11-15')], TODAY)).toBe(false);
    expect(isRunHeavyWeek([rec('run', '2026-11-16')], TODAY)).toBe(true);
    expect(isRunHeavyWeek([rec('run', '2026-11-23')], TODAY)).toBe(false);
  });
});
