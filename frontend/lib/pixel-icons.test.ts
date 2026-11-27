import { PIXEL_ICONS, PIXEL_SIZE, REST_ALTERNATIVES, pixelRuns } from './pixel-icons';

// ドット絵アイコンの形の検査（02-9 PR 3）。16行・各16文字・使える文字だけ。見た目そのものは実機で確かめる（jsdom では描画を測れない）
const ALL = { ...PIXEL_ICONS, ...REST_ALTERNATIVES };

describe('ドット絵アイコン', () => {
  it.each(Object.entries(ALL))('%s は %i×%i のマスで、使える文字だけ', (_name, rows) => {
    expect(rows).toHaveLength(PIXEL_SIZE);
    for (const row of rows) {
      expect(row).toHaveLength(PIXEL_SIZE);
      expect(row).toMatch(/^[.kabhw]+$/);
    }
  });

  it('どのアイコンにも輪郭（k）と主役の色（a）がある。空のアイコンは無い', () => {
    for (const rows of Object.values(ALL)) {
      const text = rows.join('');
      expect(text).toContain('k');
      expect(text).toContain('a');
    }
  });

  it('pixelRuns: 同じ色が横に続くところは1つの四角にまとめ、透明は描かない', () => {
    expect(pixelRuns(['.kkaa.', 'wwww..'])).toEqual([
      { x: 1, y: 0, w: 2, ch: 'k' },
      { x: 3, y: 0, w: 2, ch: 'a' },
      { x: 0, y: 1, w: 4, ch: 'w' },
    ]);
    expect(pixelRuns(['....'])).toEqual([]);
  });

  it('四角の数が多すぎない（1つのアイコンで 80 個以内。描画を軽く保つ）', () => {
    for (const rows of Object.values(ALL)) expect(pixelRuns(rows).length).toBeLessThanOrEqual(80);
  });
});
