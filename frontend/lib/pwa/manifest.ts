import type { MetadataRoute } from 'next';

// ホーム画面に追加できる情報（F-25 PR-1）。iOS の Web Push はホーム画面に追加したアプリでだけ使えるので、通知（PR-2）の前提になる。
// 色は docs/screen-design.md 6章の teal-dark（#0e7f83。白文字 4.79）と面の色（#f4f6f8）
export const THEME_COLOR = '#0e7f83';
export const BACKGROUND_COLOR = '#f4f6f8';

// any: そのまま出す。maskable: 端末が丸や角丸に切り取っても欠けないよう、中身を内側 80% に収めた別の画像
export const MANIFEST_ICONS: NonNullable<MetadataRoute.Manifest['icons']> = [
  { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
  { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
  { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
];

export function buildManifest(): MetadataRoute.Manifest {
  return {
    name: 'FitLog',
    short_name: 'FitLog',
    description: '少人数で使う、筋トレとランの記録アプリ',
    start_url: '/',
    display: 'standalone',
    lang: 'ja',
    theme_color: THEME_COLOR,
    background_color: BACKGROUND_COLOR,
    icons: MANIFEST_ICONS,
  };
}
