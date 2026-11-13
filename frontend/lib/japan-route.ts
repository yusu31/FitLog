// 日本縦断（F-28。docs/features.md 2.16）。ランの累計距離で、鹿児島から稚内までの決まった道を進む。
// 地図は略図（viewBox 220×300 の SVG）で、形も距離も目安（仮置き。実際の道のりとは合わない）。「あと◯km」は出さない
export type RoutePoint = { name: string; km: number; x: number; y: number };

export const JAPAN_ROUTE: readonly RoutePoint[] = [
  { name: '鹿児島', km: 0, x: 40, y: 280 },
  { name: '福岡', km: 270, x: 48, y: 258 },
  { name: '広島', km: 560, x: 72, y: 244 },
  { name: '大阪', km: 880, x: 102, y: 230 },
  { name: '名古屋', km: 1000, x: 124, y: 220 },
  { name: '東京', km: 1330, x: 150, y: 208 },
  { name: '仙台', km: 1650, x: 160, y: 166 },
  { name: '青森', km: 2000, x: 158, y: 126 },
  { name: '札幌', km: 2400, x: 166, y: 76 },
  { name: '稚内', km: 3000, x: 174, y: 26 },
];

export type RoutePosition = {
  name: string; // 今いる場所（最後に通った地点の名前）
  x: number;
  y: number;
  passed: number; // 通った地点の数（出発点を含む）
  reached: boolean; // 終点（稚内）に着いたか
};

export function locateOnRoute(totalMeters: number): RoutePosition {
  const km = Number.isFinite(totalMeters) && totalMeters > 0 ? totalMeters / 1000 : 0;
  const last = JAPAN_ROUTE.length - 1;
  if (km >= JAPAN_ROUTE[last].km) return { name: JAPAN_ROUTE[last].name, x: JAPAN_ROUTE[last].x, y: JAPAN_ROUTE[last].y, passed: JAPAN_ROUTE.length, reached: true };
  let i = 0;
  while (km >= JAPAN_ROUTE[i + 1].km) i++;
  const [a, b] = [JAPAN_ROUTE[i], JAPAN_ROUTE[i + 1]];
  const t = (km - a.km) / (b.km - a.km);
  return { name: a.name, x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, passed: i + 1, reached: false };
}

export function trekText(totalMeters: number, pos: RoutePosition): string {
  const km = Math.round(Math.max(0, totalMeters) / 100) / 10;
  return pos.reached
    ? `これまでに走ったのは ${km}km。鹿児島から稚内まで、日本縦断おつかれさま！`
    : `これまでに走ったのは ${km}km。鹿児島から北へ進んで、いまは${pos.name}のあたり。`;
}
