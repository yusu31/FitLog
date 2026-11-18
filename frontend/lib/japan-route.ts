// 日本縦断（F-28。docs/features.md 2.16）。ランの累計距離で、鹿児島から稚内までの決まった道を進む。
// 地図は本物の地図（MapLibre）の上に、地点を直線でつないで描く。道のりの形も距離も目安（実際の道のりとは合わない）。「あと◯km」は出さない
// 地点は誰でも知っている主要都市だけ（2026-11-17 本人の決定。最初の目標を近くするため熊本を足した）
export type RoutePoint = { name: string; km: number; lng: number; lat: number };

export const JAPAN_ROUTE: readonly RoutePoint[] = [
  { name: '鹿児島', km: 0, lng: 130.558, lat: 31.597 },
  { name: '熊本', km: 170, lng: 130.742, lat: 32.79 },
  { name: '福岡', km: 270, lng: 130.402, lat: 33.59 },
  { name: '広島', km: 560, lng: 132.46, lat: 34.397 },
  { name: '岡山', km: 700, lng: 133.935, lat: 34.662 },
  { name: '大阪', km: 880, lng: 135.502, lat: 34.694 },
  { name: '京都', km: 930, lng: 135.768, lat: 35.012 },
  { name: '名古屋', km: 1000, lng: 136.906, lat: 35.181 },
  { name: '静岡', km: 1130, lng: 138.383, lat: 34.977 },
  { name: '東京', km: 1330, lng: 139.692, lat: 35.689 },
  { name: '仙台', km: 1650, lng: 140.872, lat: 38.269 },
  { name: '盛岡', km: 1830, lng: 141.153, lat: 39.702 },
  { name: '青森', km: 2000, lng: 140.74, lat: 40.822 },
  { name: '函館', km: 2150, lng: 140.729, lat: 41.769 },
  { name: '札幌', km: 2400, lng: 141.354, lat: 43.062 },
  { name: '旭川', km: 2600, lng: 142.365, lat: 43.77 },
  { name: '稚内', km: 3000, lng: 141.673, lat: 45.416 },
];

// 1周ぶんの距離（km）。稚内に着いたら鹿児島に戻って2周目、3周目…と何周でも続ける
export const TOTAL_KM = JAPAN_ROUTE[JAPAN_ROUTE.length - 1].km;

export type RoutePosition = {
  name: string; // 今いる場所（その周で最後に通った地点の名前）
  lng: number;
  lat: number;
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
  return { name: a.name, lng: a.lng + (b.lng - a.lng) * t, lat: a.lat + (b.lat - a.lat) * t, passed: i + 1, lap, kmInLap: km };
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
