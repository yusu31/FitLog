import { buildManifest, MANIFEST_ICONS } from './manifest';

// ホーム画面に追加できる条件（F-25 PR-1）。ブラウザが「アプリとして追加できる」と判断する必須項目を押さえる:
// name・start_url・display が standalone・192 と 512 のアイコン
describe('buildManifest（ホーム画面に追加するための情報）', () => {
  const m = buildManifest();

  it('名前・開始位置・表示方法がそろっている（必須項目）', () => {
    expect(m.name).toBe('FitLog');
    expect(m.short_name).toBe('FitLog');
    expect(m.start_url).toBe('/');
    expect(m.display).toBe('standalone');
  });

  it('192・512 のアイコンがあり、どれも png', () => {
    const sizes = (m.icons ?? []).map((i) => i.sizes);
    expect(sizes).toContain('192x192');
    expect(sizes).toContain('512x512');
    expect((m.icons ?? []).every((i) => i.type === 'image/png')).toBe(true);
  });

  it('端末の丸や角丸に切り取られても欠けない maskable のアイコンが別にある（any と同じ画像を兼ねない）', () => {
    const maskable = (m.icons ?? []).filter((i) => i.purpose === 'maskable');
    const any = (m.icons ?? []).filter((i) => i.purpose === 'any');
    expect(maskable.length).toBeGreaterThanOrEqual(1);
    expect(any.length).toBeGreaterThanOrEqual(2);
    expect(maskable.every((i) => !any.some((a) => a.src === i.src))).toBe(true);
  });

  it('アイコンの置き場所は public/icons/ の中（公開 URL と一致）', () => {
    expect(MANIFEST_ICONS.every((i) => i.src.startsWith('/icons/'))).toBe(true);
  });

  it('色は 16 進の色コード（テーマ色・背景色）', () => {
    expect(m.theme_color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(m.background_color).toMatch(/^#[0-9a-f]{6}$/i);
  });
});
