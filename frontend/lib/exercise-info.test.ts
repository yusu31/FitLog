import { exerciseGuide, exerciseHint, exerciseImages } from './exercise-info';

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

describe('DB の値を優先する（D3-2）', () => {
  it('cue があれば予備の文言より優先し、無ければ予備の文言に戻る', () => {
    expect(exerciseHint({ id: seedId(1), isCustom: false, cue: 'DB の文言' })).toBe('DB の文言');
    expect(exerciseHint({ id: seedId(1), isCustom: false, cue: null })).toContain('バー');
    // 一覧に無い ID でも、DB が文言を持っていれば出す
    expect(exerciseHint({ id: 'e-new', isCustom: false, cue: '新しい種目' })).toBe('新しい種目');
    // じぶんの種目には、cue があっても出さない
    expect(exerciseHint({ id: 'e-mine', isCustom: true, cue: 'x' })).toBeUndefined();
  });
});

describe('exerciseGuide（開いたときの説明）', () => {
  const full = { id: seedId(1), isCustom: false, muscles: ['大胸筋'], difficulty: 2, steps: ['a', 'b'] };

  it('筋肉・難しさ・手順をそのまま返す', () => {
    expect(exerciseGuide(full)).toEqual({ muscles: ['大胸筋'], difficulty: 2, steps: ['a', 'b'] });
  });

  it('項目が欠けていても、ある項目だけ返す。1つも無ければ undefined', () => {
    expect(exerciseGuide({ ...full, muscles: null, steps: null })).toEqual({ muscles: [], difficulty: 2, steps: [] });
    expect(exerciseGuide({ id: seedId(1), isCustom: false, muscles: null, difficulty: null, steps: null })).toBeUndefined();
    expect(exerciseGuide({ id: seedId(1), isCustom: false })).toBeUndefined();
  });

  it('難しさが 1〜3 の外なら出さない。じぶんの種目には出さない', () => {
    expect(exerciseGuide({ ...full, muscles: null, steps: null, difficulty: 5 })).toBeUndefined();
    expect(exerciseGuide({ ...full, isCustom: true })).toBeUndefined();
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
