// ルートの地図に渡す形（GeoJSON）と、表示範囲の計算（F-15）。純粋な関数だけを置く。地図の部品は components/record-detail/route-map.tsx。
// 点は [経度, 緯度]（GeoJSON と同じ。API の run.route もこの並び）。

export type RouteLike = { type: 'LineString'; coordinates: number[][] };
export type Bounds = [[number, number], [number, number]]; // [[西, 南], [東, 北]]

type Feature<G, P> = { type: 'Feature'; properties: P; geometry: G };
export type RouteLineFeature = Feature<RouteLike, Record<string, never>>;
export type RouteEndsCollection = {
  type: 'FeatureCollection';
  features: Feature<{ type: 'Point'; coordinates: number[] }, { kind: 'start' | 'end' }>[];
};

// ルートが全部入る範囲。点が1直線に並んでいても（面積0でも）そのまま返す
export function routeBounds(route: RouteLike): Bounds {
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const [lon, lat] of route.coordinates) {
    if (lon < west) west = lon;
    if (lon > east) east = lon;
    if (lat < south) south = lat;
    if (lat > north) north = lat;
  }
  return [
    [west, south],
    [east, north],
  ];
}

// 2つの範囲がどちらも入る範囲（今回のルートと前回のルートを1画面に収める。F-17）
export const mergeBounds = (a: Bounds, b: Bounds): Bounds => [
  [Math.min(a[0][0], b[0][0]), Math.min(a[0][1], b[0][1])],
  [Math.max(a[1][0], b[1][0]), Math.max(a[1][1], b[1][1])],
];

export const routeLine = (route: RouteLike): RouteLineFeature => ({ type: 'Feature', properties: {}, geometry: route });

// スタート（最初の点）とゴール（最後の点）
export function routeEnds(route: RouteLike): RouteEndsCollection {
  const first = route.coordinates[0];
  const last = route.coordinates[route.coordinates.length - 1];
  return {
    type: 'FeatureCollection',
    features: [
      { type: 'Feature', properties: { kind: 'start' }, geometry: { type: 'Point', coordinates: first } },
      { type: 'Feature', properties: { kind: 'end' }, geometry: { type: 'Point', coordinates: last } },
    ],
  };
}
