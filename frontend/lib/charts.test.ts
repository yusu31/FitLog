import { barShape, lineShape } from './charts';

// グラフの形の計算（レポートの棒・折れ線。docs/testing-design.md 3-14）。画面の描画（SVG）は jsdom では測れないので、形は数値で守る。

describe('barShape（棒の形）', () => {
  it('空なら棒なし・最大 0', () => {
    expect(barShape([])).toMatchObject({ bars: [], max: 0 });
  });
  it('全部 0 の週は高さ 0（土台の線だけ）・最大 0', () => {
    const s = barShape([0, 0, 0]);
    expect(s.max).toBe(0);
    expect(s.bars.every((b) => b.h === 0)).toBe(true);
  });
  it('いちばん大きい週が最も高く、他は比例する。0 は 0', () => {
    const s = barShape([0, 50, 100], 300, 100, 10);
    expect(s.max).toBe(100);
    expect(s.bars[0].h).toBe(0);
    expect(s.bars[2].h).toBe(80); // 高さ100 から上下の余白 10×2 を引いた 80 が最大
    expect(s.bars[1].h).toBe(40);
  });
  it('棒は左から右へ重ならずに並び、枠の中に収まる', () => {
    const s = barShape([1, 2, 3, 4], 320, 120, 16);
    for (let i = 1; i < s.bars.length; i++) expect(s.bars[i].x).toBeGreaterThanOrEqual(s.bars[i - 1].x + s.bars[i - 1].w);
    expect(s.bars[0].x).toBeGreaterThanOrEqual(16);
    const last = s.bars.at(-1)!;
    expect(last.x + last.w).toBeLessThanOrEqual(320 - 16);
  });
});

describe('lineShape（折れ線の形）', () => {
  it('空なら null', () => {
    expect(lineShape([])).toBeNull();
  });
  it('1点だけなら中央に置く（幅 0 で割らない）', () => {
    const s = lineShape([{ date: '2026-11-10', value: 60 }], 320, 160, 16)!;
    expect(s.dots).toHaveLength(1);
    expect(s.dots[0].x).toBe(160);
    expect(Number.isFinite(s.dots[0].y)).toBe(true);
  });
  it('全部同じ値でも割り算が壊れない（縦に少し幅を持たせる）', () => {
    const s = lineShape([{ date: '2026-11-10', value: 60 }, { date: '2026-11-12', value: 60 }])!;
    expect(s.max).toBeGreaterThan(s.min);
    expect(s.dots.every((d) => Number.isFinite(d.y))).toBe(true);
  });
  it('横は日付の間隔どおり。大きい値ほど上（y が小さい）', () => {
    const s = lineShape([{ date: '2026-11-10', value: 60 }, { date: '2026-11-11', value: 70 }, { date: '2026-11-14', value: 65 }], 320, 160, 16)!;
    expect(s.dots[0].x).toBe(16);
    expect(s.dots[2].x).toBe(304);
    expect(s.dots[1].x).toBeCloseTo(16 + (288 * 1) / 4, 1);
    expect(s.dots[1].y).toBeLessThan(s.dots[0].y);
    expect(s.path.startsWith('M16.0 ')).toBe(true);
  });
  it('縦軸の上端・下端は値を含む整数（ラベル用）', () => {
    const s = lineShape([{ date: '2026-11-10', value: 60.4 }, { date: '2026-11-12', value: 62.6 }])!;
    expect(s.min).toBeLessThanOrEqual(60.4);
    expect(s.max).toBeGreaterThanOrEqual(62.6);
    expect(Number.isInteger(s.min) && Number.isInteger(s.max)).toBe(true);
  });
});
