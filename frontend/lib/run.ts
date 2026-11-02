// ラン（S-13・features.md 2.4）の変換と検査。純粋な関数だけを置く。
// API は距離を m、時間を秒の整数で受ける（design.md 4章）。画面では km と 分・秒で入れる。
// ペース（分/km）は DB に持たず、画面が計算して見せる。

export const DISTANCE_M_MIN = 100; // 0.1km
export const DISTANCE_M_MAX = 200_000; // 200km
export const DURATION_S_MIN = 60; // 1分
export const DURATION_S_MAX = 86_400; // 24時間

// 全角の数字・記号を半角へ。スマホの日本語入力で全角のまま来ることがある
const toHalfWidth = (text: string): string =>
  text
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[．。]/g, '.')
    .replace(/[，、,]/g, '.');

// 5.2 → 5200。0.3 * 1000 のような誤差（300.00000000000006）を出さないよう、丸めて整数にする
export const kmToMeters = (km: number): number => Math.round(km * 1000);

export const minSecToSeconds = (minutes: number, seconds: number): number => minutes * 60 + seconds;

// 距離の入力（km）を数にする。読めない値（空・文字・負・指数表記）は NaN
export function parseKm(text: string): number {
  const t = toHalfWidth(text.trim());
  return /^\d+(\.\d+)?$/.test(t) ? Number(t) : NaN;
}

// 分・秒の入力を整数にする。空欄は 0（分だけ・秒だけを入れてもよい）。読めない値は NaN
export function parseWholeNumber(text: string): number {
  const t = toHalfWidth(text.trim());
  if (t === '') return 0;
  return /^\d+$/.test(t) ? Number(t) : NaN;
}

export type RunError = 'distance' | 'duration';

// 範囲の検査（T-RUN-01〜08）。範囲の中なら null。距離を先に見る
export function validateRun(distanceM: number, durationS: number): RunError | null {
  if (!Number.isInteger(distanceM) || distanceM < DISTANCE_M_MIN || distanceM > DISTANCE_M_MAX) return 'distance';
  if (!Number.isInteger(durationS) || durationS < DURATION_S_MIN || durationS > DURATION_S_MAX) return 'duration';
  return null;
}

// 1kmあたりの秒数（四捨五入）。距離が 0 以下のときは null
export function paceSecPerKm(distanceM: number, durationS: number): number | null {
  if (!(distanceM > 0)) return null;
  return Math.round(durationS / (distanceM / 1000));
}

// 371 → 6'11"/km
export const formatPace = (secPerKm: number): string => {
  const m = Math.floor(secPerKm / 60);
  const s = secPerKm % 60;
  return `${m}'${String(s).padStart(2, '0')}"/km`;
};
