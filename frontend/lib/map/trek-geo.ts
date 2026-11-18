import { JAPAN_ROUTE, type RoutePosition } from '@/lib/japan-route';

// 日本縦断の地図に描くデータ（GeoJSON）。座標は [経度, 緯度]。地点を直線でつなぐ（道のりの形は目安）
export function trekGeo(pos: RoutePosition) {
  const all = JAPAN_ROUTE.map((r) => [r.lng, r.lat]);
  const done = [...JAPAN_ROUTE.slice(0, pos.passed).map((r) => [r.lng, r.lat]), [pos.lng, pos.lat]];
  return {
    all: { type: 'Feature' as const, properties: {}, geometry: { type: 'LineString' as const, coordinates: all } },
    done: { type: 'Feature' as const, properties: {}, geometry: { type: 'LineString' as const, coordinates: done } },
    cities: {
      type: 'FeatureCollection' as const,
      features: JAPAN_ROUTE.map((r) => ({ type: 'Feature' as const, properties: { name: r.name }, geometry: { type: 'Point' as const, coordinates: [r.lng, r.lat] } })),
    },
    here: { type: 'Feature' as const, properties: {}, geometry: { type: 'Point' as const, coordinates: [pos.lng, pos.lat] } },
  };
}
