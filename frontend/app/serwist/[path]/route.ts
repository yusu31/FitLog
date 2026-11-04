import { createSerwistRoute } from '@serwist/turbopack';
import { PRECACHE_PAGES } from '@/lib/offline/precache-pages';

// 画面の HTML を全部、端末に先に保存する（静的書き出しの各ページ）。
// revision は「中身が変わったか」の印。ビルドごとに変え、画面を更新したら端末の保存も入れ替わるようにする
const revision = process.env.SW_REVISION ?? String(Date.now());

export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } = createSerwistRoute({
  additionalPrecacheEntries: PRECACHE_PAGES.map((url) => ({ url, revision })),
  swSrc: 'app/sw.ts',
  useNativeEsbuild: true,
});
