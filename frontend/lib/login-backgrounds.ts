// ログイン画面の背景の絵（差し替え式。Issue #473）。
// 絵を足す手順: ① public/login-bg/ に画像（WebP・縦長 9:16）を置く ② 下の配列に { src: '/login-bg/名前.webp' } を足す。
// 配列が空・画像が読めないときは、今までの「ティールの帯＋縞」のままになる。position は絵の見せたい場所（CSS の background-position。省略時は中央）
export type LoginBackground = { src: string; position?: string };

export const LOGIN_BACKGROUNDS: readonly LoginBackground[] = [];

// 覚えておく場所（この端末で前回出した絵の番号）
export const LOGIN_BG_KEY = 'fitlog-login-bg';

// 出す絵の番号を決める。?bg=番号 があればそれに固定（E2E・監査・撮影用）。無ければ前回と違う絵をランダムに選ぶ。空なら null
export function pickBackground(count: number, previous: number | null, fixed: string | null, random: () => number = Math.random): number | null {
  if (count <= 0) return null;
  if (fixed !== null && /^\d+$/.test(fixed)) {
    const n = Number(fixed);
    if (n < count) return n;
  }
  if (count === 1) return 0;
  // 前回の番号を除いた中から選ぶ（続けて同じ絵にしない）
  const candidates = Array.from({ length: count }, (_, i) => i).filter((i) => i !== previous);
  return candidates[Math.min(Math.floor(random() * candidates.length), candidates.length - 1)];
}
