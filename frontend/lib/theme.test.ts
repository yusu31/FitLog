import { isDark, parseTheme, THEME_BOOT_SCRIPT } from './theme';

describe('theme', () => {
  it('保存値が壊れていたらライト', () => {
    expect(parseTheme(null)).toBe('light');
    expect(parseTheme('xxx')).toBe('light');
    expect(parseTheme('auto')).toBe('auto');
  });
  it('AUTO は端末の設定に従い、LIGHT・DARK は固定', () => {
    expect(isDark('auto', true)).toBe(true);
    expect(isDark('auto', false)).toBe(false);
    expect(isDark('light', true)).toBe(false);
    expect(isDark('dark', false)).toBe(true);
  });
  it('先読みスクリプトは、保存キーと dark の付与を含む', () => {
    expect(THEME_BOOT_SCRIPT).toContain('fitlog-theme');
    expect(THEME_BOOT_SCRIPT).toContain("classList.add('dark')");
  });
});
