// 日本縦断（F-28。docs/features.md 2.16）。ランの累計距離で、鹿児島から稚内までの決まった道を進む。
// 地図は略図（viewBox 220×300 の SVG）で、形も距離も目安（仮置き。実際の道のりとは合わない）。「あと◯km」は出さない
// 地点は誰でも知っている主要都市だけ（2026-11-17 本人の決定。最初の目標を近くするため熊本を足した）
export type RoutePoint = { name: string; km: number; x: number; y: number };

export const JAPAN_ROUTE: readonly RoutePoint[] = [
  { name: '鹿児島', km: 0, x: 40, y: 280 },
  { name: '熊本', km: 170, x: 44, y: 267 },
  { name: '福岡', km: 270, x: 48, y: 258 },
  { name: '広島', km: 560, x: 72, y: 244 },
  { name: '岡山', km: 700, x: 85, y: 238 },
  { name: '大阪', km: 880, x: 102, y: 230 },
  { name: '京都', km: 930, x: 111, y: 226 },
  { name: '名古屋', km: 1000, x: 124, y: 220 },
  { name: '静岡', km: 1130, x: 134, y: 215 },
  { name: '東京', km: 1330, x: 150, y: 208 },
  { name: '仙台', km: 1650, x: 160, y: 166 },
  { name: '盛岡', km: 1830, x: 159, y: 146 },
  { name: '青森', km: 2000, x: 158, y: 126 },
  { name: '函館', km: 2150, x: 161, y: 107 },
  { name: '札幌', km: 2400, x: 166, y: 76 },
  { name: '旭川', km: 2600, x: 169, y: 60 },
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

// ラン直後の前進（U6）。保存前の累計と保存後の累計を比べ、地点をまたいだら着いた地点の名前を返す（1周を超えたら終点の稚内）。
// 次の地点までは保存後の位置から言う（「あと◯km」は出さない）
export function trekProgress(beforeM: number, afterM: number): { arrived: string | null; next: string } {
  const before = locateOnRoute(beforeM);
  const after = locateOnRoute(afterM);
  const arrived = after.lap > before.lap ? JAPAN_ROUTE[JAPAN_ROUTE.length - 1].name : after.passed > before.passed ? after.name : null;
  return { arrived, next: nextText(after) };
}

export function trekText(totalMeters: number, pos: RoutePosition): string {
  const km = Math.round(Math.max(0, totalMeters) / 100) / 10;
  return pos.lap === 1
    ? `これまでに走ったのは ${km}km。鹿児島から北へ進んで、いまは${pos.name}のあたり。`
    : `これまでに走ったのは ${km}km。日本縦断を${pos.lap - 1}回達成して、いまは${pos.lap}周目の${pos.name}のあたり。`;
}
