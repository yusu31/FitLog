// 地図が出せないときの代替の線画（L13）用の計算。経度・緯度（[経度, 緯度]）を、SVG の箱の座標に直す。
// 緯度で東西の幅が縮むぶん（cos 緯度）を掛けて、形がつぶれないようにする。純粋な関数だけ
export type Pt = number[];

export type Projector = (p: Pt) => [number, number];

export function makeProjector(all: readonly Pt[], width: number, height: number, pad: number): Projector {
  const lons = all.map((p) => p[0]);
  const lats = all.map((p) => p[1]);
  const west = Math.min(...lons);
  const east = Math.max(...lons);
  const south = Math.min(...lats);
  const north = Math.max(...lats);
  const k = Math.cos((((south + north) / 2) * Math.PI) / 180);
  const spanX = (east - west) * k; // 0 でもよい（幅の側の scale が Infinity になるだけで、高さの側の scale が選ばれる）
  const spanY = Math.max(north - south, 1e-9);
  const scale = Math.min((width - pad * 2) / spanX, (height - pad * 2) / spanY);
  const offX = (width - spanX * scale) / 2;
  const offY = (height - spanY * scale) / 2;
  return ([lon, lat]) => [offX + (lon - west) * k * scale, offY + (north - lat) * scale];
}

export function toPoints(project: Projector, coords: readonly Pt[]): string {
  return coords.map((c) => project(c).map((v) => v.toFixed(1)).join(',')).join(' ');
}
