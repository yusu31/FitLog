// MapLibre の読み込み。大きく、WebGL が要るので、地図を出す画面で初めて読み込む（動的 import）。
// MapLibre 6 は描画の計算を別のスレッド（Worker）で行う。Worker のファイルの場所は、バンドラーが解決した URL を教える必要がある
// （教えないと、実ブラウザで「Worker failed to load」になり、地図の中身が描かれない）。
type MapLibre = typeof import('maplibre-gl');

let loading: Promise<MapLibre> | undefined;

export function loadMapLibre(): Promise<MapLibre> {
  loading ??= import('maplibre-gl')
    .then((m) => {
      m.setWorkerUrl(new URL('maplibre-gl/dist/maplibre-gl-worker.mjs', import.meta.url).href);
      return m;
    })
    .catch((e: unknown) => {
      loading = undefined; // 失敗を覚え込まない（次に開いたとき、もう一度試せる）
      throw e;
    });
  return loading;
}
