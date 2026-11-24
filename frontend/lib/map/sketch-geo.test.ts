import { makeProjector, toPoints } from './sketch-geo';

describe('makeProjector（地図なしの線画。L13）', () => {
  const pts = [
    [139.0, 35.0],
    [140.0, 36.0],
  ];

  it('北が上（緯度が大きいほど y が小さい）、東が右（経度が大きいほど x が大きい）', () => {
    const p = makeProjector(pts, 320, 160, 10);
    const [x0, y0] = p(pts[0]);
    const [x1, y1] = p(pts[1]);
    expect(x1).toBeGreaterThan(x0);
    expect(y1).toBeLessThan(y0);
  });

  it('全部の点が、余白（pad）を残した箱の中に入る', () => {
    const p = makeProjector(pts, 320, 160, 10);
    for (const c of pts) {
      const [x, y] = p(c);
      expect(x).toBeGreaterThanOrEqual(10 - 1e-6);
      expect(x).toBeLessThanOrEqual(310 + 1e-6);
      expect(y).toBeGreaterThanOrEqual(10 - 1e-6);
      expect(y).toBeLessThanOrEqual(150 + 1e-6);
    }
  });

  it('1直線に並んだ点・同じ点だけでも落ちない（NaN にならない）', () => {
    const p = makeProjector([[139, 35], [139, 35]], 320, 160, 10);
    const [x, y] = p([139, 35]);
    expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true);
  });

  it('toPoints は SVG の points 文字列（x,y を空白でつなぐ）', () => {
    const p = makeProjector(pts, 100, 100, 0);
    expect(toPoints(p, pts)).toMatch(/^\d+\.\d,\d+\.\d \d+\.\d,\d+\.\d$/);
  });
});
