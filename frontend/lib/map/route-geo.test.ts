import { describe, expect, it } from 'vitest';
import { routeBounds, routeEnds, routeLine } from './route-geo';

// 地図に渡す形（GeoJSON）と、表示範囲の計算。純粋な関数だけ（地図の部品は route-map.tsx）
const route = (coordinates: [number, number][]) => ({ type: 'LineString' as const, coordinates });

describe('routeBounds（ルートが全部入る範囲）', () => {
  it('[[西, 南], [東, 北]] を返す', () => {
    expect(routeBounds(route([[139.7, 35.6], [139.8, 35.7], [139.6, 35.65]]))).toEqual([
      [139.6, 35.6],
      [139.8, 35.7],
    ]);
  });

  it('点が2つで南北だけ動いた（経度が同じ）ときも、範囲は線になる（面積0でも返す）', () => {
    expect(routeBounds(route([[140, 35], [140, 36]]))).toEqual([
      [140, 35],
      [140, 36],
    ]);
  });

  it('負の座標（西経・南緯）でも最小・最大が正しい', () => {
    expect(routeBounds(route([[-70.5, -33.4], [-70.4, -33.5]]))).toEqual([
      [-70.5, -33.5],
      [-70.4, -33.4],
    ]);
  });
});

describe('routeLine（地図に引く線）', () => {
  it('LineString の Feature にする', () => {
    const r = route([[139.7, 35.6], [139.8, 35.7]]);
    expect(routeLine(r)).toEqual({ type: 'Feature', properties: {}, geometry: r });
  });
});

describe('routeEnds（スタートとゴールの点）', () => {
  it('最初の点を start、最後の点を end にした2点の FeatureCollection', () => {
    const fc = routeEnds(route([[139.7, 35.6], [139.75, 35.65], [139.8, 35.7]]));
    expect(fc.type).toBe('FeatureCollection');
    expect(fc.features).toEqual([
      { type: 'Feature', properties: { kind: 'start' }, geometry: { type: 'Point', coordinates: [139.7, 35.6] } },
      { type: 'Feature', properties: { kind: 'end' }, geometry: { type: 'Point', coordinates: [139.8, 35.7] } },
    ]);
  });
});
