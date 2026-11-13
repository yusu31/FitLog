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

// 1周ぶんの距離（km）。稚内に着いたら鹿児島に戻って2周目、3周目…と何周でも続ける
export const TOTAL_KM = JAPAN_ROUTE[JAPAN_ROUTE.length - 1].km;

export type RoutePosition = {
  name: string; // 今いる場所（その周で最後に通った地点の名前）
  x: number;
  y: number;
  passed: number; // その周で通った地点の数（出発点を含む）
  lap: number; // 何周目か（1から）
  kmInLap: number; // その周の中で進んだ距離（km）
};

export function locateOnRoute(totalMeters: number): RoutePosition {
  const total = Number.isFinite(totalMeters) && totalMeters > 0 ? totalMeters / 1000 : 0;
  const lap = Math.floor(total / TOTAL_KM) + 1;
  const km = total - (lap - 1) * TOTAL_KM; // その周の中での距離（0以上・TOTAL_KM 未満）
  let i = 0;
  while (km >= JAPAN_ROUTE[i + 1].km) i++;
  const [a, b] = [JAPAN_ROUTE[i], JAPAN_ROUTE[i + 1]];
  const t = (km - a.km) / (b.km - a.km);
  return { name: a.name, x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, passed: i + 1, lap, kmInLap: km };
}

// 次の地点までの距離（F-28）。ゴールまでの残りは出さない。0.1km 単位に切り上げる（手前なのに 0.0km と出さないため）
export function nextText(pos: RoutePosition): string {
  const next = JAPAN_ROUTE[pos.passed];
  const rest = Math.ceil((next.km - pos.kmInLap) * 10 - 1e-9) / 10;
  return `次の${next.name}まで ${rest.toFixed(1)}km`;
}

export function trekText(totalMeters: number, pos: RoutePosition): string {
  const km = Math.round(Math.max(0, totalMeters) / 100) / 10;
  return pos.lap === 1
    ? `これまでに走ったのは ${km}km。鹿児島から北へ進んで、いまは${pos.name}のあたり。`
    : `これまでに走ったのは ${km}km。日本縦断を${pos.lap - 1}回達成して、いまは${pos.lap}周目の${pos.name}のあたり。`;
}
