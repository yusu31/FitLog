import { exerciseHint } from './exercise-info';

const seedId = (n: number) => `00000000-0000-4000-8000-0000000000${String(n).padStart(2, '0')}`;

describe('exerciseHint（種目の一言説明）', () => {
  it('一覧の種目30件すべてに説明がある', () => {
    for (let n = 1; n <= 30; n += 1) {
      expect(exerciseHint({ id: seedId(n), isCustom: false }), `種目 ${n}`).toBeTruthy();
    }
  });

  it('じぶんの種目と、一覧に無い ID には説明が無い', () => {
    expect(exerciseHint({ id: seedId(1), isCustom: true })).toBeUndefined();
    expect(exerciseHint({ id: 'e-unknown', isCustom: false })).toBeUndefined();
    expect(exerciseHint({ id: seedId(31), isCustom: false })).toBeUndefined();
  });
});
