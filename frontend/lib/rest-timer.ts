// 休憩タイマー（F-34）の決まりごと。画面の部品から切り離した純粋な関数。
// 長さは全種目共通で、15〜600 秒・15 秒刻み（既定 90 秒）。変えた長さは端末に控える（DB は使わない）
export const REST_DEFAULT_S = 90;
export const REST_MIN_S = 15;
export const REST_MAX_S = 600;
export const REST_STEP_S = 15;

const KEY = 'fitlog:rest-seconds';

// 範囲に収めて 15 秒刻みにそろえる。数でないときは既定
export function clampRestSeconds(seconds: number): number {
  if (!Number.isFinite(seconds)) return REST_DEFAULT_S;
  const stepped = Math.round(seconds / REST_STEP_S) * REST_STEP_S;
  return Math.min(REST_MAX_S, Math.max(REST_MIN_S, stepped));
}

export const stepRestSeconds = (seconds: number, direction: 1 | -1): number => clampRestSeconds(seconds + direction * REST_STEP_S);

// 終了時刻（ms）といま（ms）から残り秒を出す。端数は切り上げ（0.5秒残りなら1秒）。画面が裏に回って止まっていても狂わない
export const remainingSeconds = (endAtMs: number, nowMs: number): number => Math.max(0, Math.ceil((endAtMs - nowMs) / 1000));

// 90 → "1:30"
export const formatRest = (seconds: number): string => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

// 端末に控えた長さ。無い・壊れた・範囲外は既定（保存できない端末でも落ちない）
export function readRestSeconds(): number {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === null || raw.trim() === '') return REST_DEFAULT_S;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < REST_MIN_S || n > REST_MAX_S) return REST_DEFAULT_S;
    return clampRestSeconds(n);
  } catch {
    return REST_DEFAULT_S;
  }
}

export function writeRestSeconds(seconds: number): void {
  try {
    localStorage.setItem(KEY, String(clampRestSeconds(seconds)));
  } catch {
    // 保存できない端末（プライベートブラウズ等）では、次回は既定の長さから始まる
  }
}
