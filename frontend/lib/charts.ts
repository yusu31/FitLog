// グラフの形の計算（レポートの棒グラフ・折れ線。docs/features.md 2.13）。描画（SVG）は components/charts/ に置き、ここは数だけを扱う純粋な関数。
// 上下左右に pad の余白。幅 0・全部同じ値・0 件でも割り算が壊れないようにする。目標線・判定の言葉は持たない（F-27）。

export type Bar = { x: number; y: number; w: number; h: number; value: number };
export type BarShape = { width: number; height: number; max: number; bars: Bar[] };

// 棒（値は 0 以上）。いちばん大きい値が最も高い。0 は高さ 0（土台の線だけ見せる）。全部 0 なら max は 0
export function barShape(values: readonly number[], width = 320, height = 120, pad = 16): BarShape {
  const max = Math.max(0, ...values);
  const slot = values.length === 0 ? 0 : (width - pad * 2) / values.length;
  const w = slot * 0.6;
  const room = height - pad * 2;
  const bars = values.map((value, i) => {
    const h = max === 0 ? 0 : Math.round((value / max) * room * 10) / 10;
    return { x: Math.round((pad + i * slot + (slot - w) / 2) * 10) / 10, y: Math.round((height - pad - h) * 10) / 10, w: Math.round(w * 10) / 10, h, value };
  });
  return { width, height, max, bars };
}

export type LinePoint = { date: string; value: number };
export type LineShape = {
  width: number;
  height: number;
  path: string;
  dots: { x: number; y: number; date: string; value: number }[];
  // 縦軸の上端・下端（ラベル用の整数）
  min: number;
  max: number;
};

const dayNumber = (date: string): number => {
  const [y, m, d] = date.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
};

// 折れ線。横は日付の間隔どおり（古い順に渡す）、縦は値（上下に1割ほどの余白）。点が1つだけなら中央に置く
export function lineShape(points: readonly LinePoint[], width = 320, height = 160, pad = 16): LineShape | null {
  if (points.length === 0) return null;
  const values = points.map((p) => p.value);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const margin = hi === lo ? 1 : (hi - lo) * 0.1;
  const min = Math.floor(lo - margin);
  const max = Math.ceil(hi + margin);
  const first = dayNumber(points[0].date);
  const span = dayNumber(points[points.length - 1].date) - first;
  const x = (date: string) => (span === 0 ? width / 2 : pad + ((dayNumber(date) - first) / span) * (width - pad * 2));
  const y = (v: number) => pad + ((max - v) / (max - min)) * (height - pad * 2);
  return {
    width,
    height,
    min,
    max,
    path: points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.date).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' '),
    dots: points.map((p) => ({ x: Number(x(p.date).toFixed(1)), y: Number(y(p.value).toFixed(1)), date: p.date, value: p.value })),
  };
}
