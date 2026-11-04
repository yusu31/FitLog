import { describe, expect, it, vi } from 'vitest';

// MapLibre 6 は描画の計算を別のスレッド（Worker）で行う。Worker のファイルの場所は、読み込む側（バンドラー）で解決して教える必要がある。
// 教え忘れると、本物のブラウザで「Worker failed to load」になり、地図の中身が描かれない（jsdom のテストでは気づけない。実ブラウザで見つけた不具合）。
const setWorkerUrl = vi.fn();
vi.mock('maplibre-gl', () => ({ setWorkerUrl, Map: class {} }));

describe('loadMapLibre', () => {
  it('MapLibre を読み込んだとき、Worker のファイルの場所を教える。2回呼んでも1回だけ', async () => {
    const { loadMapLibre } = await import('./load-maplibre');
    const a = await loadMapLibre();
    const b = await loadMapLibre();
    expect(a).toBe(b);
    expect(setWorkerUrl).toHaveBeenCalledTimes(1);
    expect(setWorkerUrl.mock.calls[0][0]).toMatch(/maplibre-gl-worker\.mjs/);
  });
});
