// からだの計算（B14a）。DB にも Nest にも依らない純粋な関数だけ。判定の言葉（肥満・標準など）は返さない（責めない方針）

export type WeightPoint = { date: string; kg: number };

const round1 = (n: number): number => Math.round(n * 10) / 10;

// BMI = 体重(kg) ÷ 身長(m)²。小数1桁。どちらかが無い・身長が 0 以下なら null
export function bmi(weightKg: number | null, heightCm: number | null): number | null {
  if (weightKg === null || heightCm === null || heightCm <= 0) return null;
  const m = heightCm / 100;
  return round1(weightKg / (m * m));
}

const dayNumber = (date: string): number => {
  const [y, m, d] = date.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
};

// 基準日を含む、さかのぼって7日間（基準日−6日〜基準日）の体重の平均。小数1桁。1件も無ければ null
export function avg7(points: WeightPoint[], baseDate: string): number | null {
  const base = dayNumber(baseDate);
  const inWindow = points.filter((p) => {
    const diff = base - dayNumber(p.date);
    return diff >= 0 && diff <= 6;
  });
  if (inWindow.length === 0) return null;
  return round1(inWindow.reduce((sum, p) => sum + p.kg, 0) / inWindow.length);
}

// 前回の測定からの増減（最新 − 1つ前。古い順の配列を受ける）。2件未満なら null
export function deltaFromPrevious(points: WeightPoint[]): number | null {
  if (points.length < 2) return null;
  return round1(points[points.length - 1].kg - points[points.length - 2].kg);
}

// 推定1RM（Epley: 重量×(1+回数/30)）。回数が 12 を超えると外れやすいので「目安」。1回はそのままの重さ。重量 0（自重）は null
export const ONE_RM_APPROX_FROM_REPS = 13;
export function oneRepMax(weightKg: number, reps: number): { kg: number; approximate: boolean } | null {
  if (weightKg <= 0 || reps < 1) return null;
  const kg = reps === 1 ? weightKg : round1(weightKg * (1 + reps / 30));
  return { kg, approximate: reps >= ONE_RM_APPROX_FROM_REPS };
}

// ── メッツ ───────────────────────────────────────────────────────────────
// 出典: 身体活動のメッツ表 改訂第2版（2024）成人版 ver1.1.5（国立健康・栄養研究所。Compendium of Physical Activities の日本語版）。
// 2026-11-19 に PDF を取得して値を確かめた。
//  - 筋トレ: コード 02054「レジスタンス運動・複数種目・8〜15回」3.5（強い強度は 6.0・スクワット等は 5.0 だが、強さは記録から分からないので代表の 3.5）
//  - ラン: コード 12028〜12132 の「走る速さ（km/h）→ メッツ」。区分の下限を含む
export const METS_WORKOUT = 3.5;
const RUN_METS: ReadonlyArray<readonly [minKmh: number, mets: number]> = [
  [4.2, 3.3],
  [6.5, 6.5],
  [7.0, 7.8],
  [8.1, 8.5],
  [8.9, 9.0],
  [9.7, 9.3],
  [10.9, 10.5],
  [11.3, 11.0],
  [12.2, 11.8],
  [13.0, 12.0],
  [13.9, 12.5],
  [14.6, 13.0],
  [15.1, 14.8],
  [17.8, 16.8],
  [19.4, 18.5],
];

// 走る速さ（km/h）に当たるメッツ。表の最小（4.2km/h）に届かなければ null（走ったとはみなさない）
export function metsForRun(kmh: number): number | null {
  let found: number | null = null;
  for (const [min, mets] of RUN_METS) {
    if (kmh >= min) found = mets;
  }
  return found;
}

// 推定消費カロリー = メッツ × 時間(h) × 体重(kg) × 1.05。整数に丸める。時間か体重が 0 以下なら null
export function estimateKcal(mets: number, durationSec: number, weightKg: number): number | null {
  if (durationSec <= 0 || weightKg <= 0) return null;
  return Math.round(mets * (durationSec / 3600) * weightKg * 1.05);
}
