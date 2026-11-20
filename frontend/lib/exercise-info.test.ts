import { exerciseHint, exerciseImages } from './exercise-info';

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

describe('exerciseImages（静止画2枚）', () => {
  it('固定の30件すべてに、実在するファイル名の2枚が付く', async () => {
    const fs = await import('node:fs');
    for (let n = 1; n <= 30; n++) {
      const imgs = exerciseImages({ id: seedId(n), isCustom: false });
      expect(imgs, `種目 ${n}`).toBeDefined();
      for (const src of imgs!) expect(fs.existsSync(`public${src}`), src).toBe(true);
    }
  });

  it('じぶんの種目・一覧に無い ID には付かない', () => {
    expect(exerciseImages({ id: seedId(1), isCustom: true })).toBeUndefined();
    expect(exerciseImages({ id: seedId(31), isCustom: false })).toBeUndefined();
  });
});
