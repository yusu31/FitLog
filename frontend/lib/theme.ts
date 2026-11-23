// 見た目（ライト・ダーク・自動）。端末に保存し、<html> の class "dark" を付け外しする（02-9 D0-1）。
// 読み込み直後の白いちらつきを防ぐため、同じ判定を app/layout.tsx の先読みスクリプト（THEME_BOOT_SCRIPT）でも行う
export type ThemeMode = 'light' | 'dark' | 'auto';

export const THEME_KEY = 'fitlog-theme';
export const THEME_OPTIONS = [
  { value: 'light', label: 'ライト' },
  { value: 'dark', label: 'ダーク' },
  { value: 'auto', label: '自動' },
] as const satisfies readonly { value: ThemeMode; label: string }[];

// ダークのときのアドレスバーの色（ライトは PWA の THEME_COLOR）
export const DARK_THEME_COLOR = '#0f161d';

export function parseTheme(raw: string | null | undefined): ThemeMode {
  return raw === 'light' || raw === 'dark' || raw === 'auto' ? raw : 'light';
}

export function isDark(mode: ThemeMode, systemDark: boolean): boolean {
  return mode === 'dark' || (mode === 'auto' && systemDark);
}

export function readTheme(): ThemeMode {
  try {
    return parseTheme(localStorage.getItem(THEME_KEY));
  } catch {
    return 'light';
  }
}

export function applyTheme(mode: ThemeMode): void {
  const dark = isDark(mode, typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? DARK_THEME_COLOR : '#0e7f83');
}

const listeners = new Set<() => void>();
export const subscribeTheme = (fn: () => void) => {
  listeners.add(fn);
  return () => void listeners.delete(fn);
};

export function saveTheme(mode: ThemeMode): void {
  try {
    localStorage.setItem(THEME_KEY, mode);
  } catch {
    // 保存できなくても、今の画面は切り替わる
  }
  applyTheme(mode);
  listeners.forEach((fn) => fn());
}

// <head> に置く小さなスクリプト。壊れても画面を止めない（try/catch）
export const THEME_BOOT_SCRIPT = `try{var m=localStorage.getItem('${THEME_KEY}');if(m==='dark'||(m==='auto'&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}`;
