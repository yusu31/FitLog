// 地図の設定。**地図スタイルの URL はここ1か所**で決める（docs/tech-stack.md の地図）。
// 開発中は OpenFreeMap（無料・キー不要。ただし無保証・予告なく終了しうる）。
// 本番は、Protomaps の日本全域の PMTiles を自分の S3 + CloudFront から配る（公開 02-3 の後の別 PR）。
// そのときは、環境変数 NEXT_PUBLIC_MAP_STYLE_URL に自前のスタイルを指すだけで切り替わるようにしておく。
export const OPENFREEMAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';

// 指定が https の URL か、同じサイトの相対パス（/ で始まり // でない）のときだけ使う。空・http・読めない値は既定に戻す
export function resolveMapStyleUrl(value: string | undefined): string {
  const v = value?.trim() ?? '';
  if (v.startsWith('https://') || (v.startsWith('/') && !v.startsWith('//'))) return v;
  return OPENFREEMAP_STYLE_URL;
}

// NEXT_PUBLIC_ の値はビルド時に埋め込まれる（静的書き出し）
export const MAP_STYLE_URL = resolveMapStyleUrl(process.env.NEXT_PUBLIC_MAP_STYLE_URL);
