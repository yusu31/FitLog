import { render, screen, waitFor } from '@testing-library/react';
import { DETAIL_MESSAGES } from '@/lib/messages';
import { OPENFREEMAP_STYLE_URL } from '@/lib/map/map-config';
import { TILE_ERROR_LIMIT } from '@/lib/map/map-failure';
import { MAP_LOCALE_JA } from '@/lib/map/locale-ja';
import { RouteMap } from './route-map';

// 本物の地図（MapLibre）は WebGL が要り、jsdom では動かない。部品を差し替えて、組み立て方（線・点・範囲合わせ・後片付け）を確かめる。
// 本物の描画は、実ブラウザで確かめる（PR の確認手順）
const h = vi.hoisted(() => {
  type Opts = { container: HTMLElement; style: string; cooperativeGestures?: boolean; interactive?: boolean; locale?: unknown };
  class FakeMap {
    static instances: FakeMap[] = [];
    static failWith: Error | null = null;
    handlers: Record<string, (e?: unknown) => void> = {};
    sources: Record<string, unknown> = {};
    layers: { id: string; source: string; type: string; paint?: Record<string, unknown> }[] = [];
    controls: unknown[] = [];
    fitBounds = vi.fn();
    remove = vi.fn();
    constructor(public opts: Opts) {
      if (FakeMap.failWith) throw FakeMap.failWith;
      FakeMap.instances.push(this);
    }
    on(event: string, cb: (e?: unknown) => void) {
      this.handlers[event] = cb;
      return this;
    }
    addSource(id: string, source: unknown) {
      this.sources[id] = source;
    }
    addLayer(layer: { id: string; source: string; type: string; paint?: Record<string, unknown> }) {
      this.layers.push(layer);
    }
    addControl(control: unknown) {
      this.controls.push(control);
    }
  }
  class FakeNavigationControl {}
  return { FakeMap, FakeNavigationControl };
});
vi.mock('maplibre-gl', () => ({ Map: h.FakeMap, NavigationControl: h.FakeNavigationControl, setWorkerUrl: vi.fn() }));

const ROUTE = { type: 'LineString' as const, coordinates: [[139.7, 35.6], [139.75, 35.65], [139.8, 35.7]] as [number, number][] };

beforeEach(() => {
  h.FakeMap.instances = [];
  h.FakeMap.failWith = null;
});

const lastMap = () => h.FakeMap.instances[h.FakeMap.instances.length - 1];

describe('RouteMap（ランのルートの地図）', () => {
  it('地図の入れ物に名前（aria-label）がある', async () => {
    render(<RouteMap route={ROUTE} />);
    expect(await screen.findByRole('img', { name: DETAIL_MESSAGES.mapLabel })).toBeInTheDocument();
  });

  it('設定の1か所のスタイル URL で地図を作り、ページのスクロールを奪わない（二本指で動かす）', async () => {
    render(<RouteMap route={ROUTE} />);
    await waitFor(() => expect(h.FakeMap.instances).toHaveLength(1));
    expect(lastMap().opts.style).toBe(OPENFREEMAP_STYLE_URL);
    expect(lastMap().opts.cooperativeGestures).toBe(true); // PC は今のまま（matchMedia が無い・マウス）
  });

  // L7: 触る端末は1本指がページのスクロール。「Ctrl を押しながら」の案内（cooperativeGestures）を出さない
  it('L7: 触る端末（pointer: coarse）では cooperativeGestures を使わず、1本指のドラッグ（dragPan）を切る', async () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q === '(pointer: coarse)' }));
    render(<RouteMap route={ROUTE} />);
    await waitFor(() => expect(h.FakeMap.instances).toHaveLength(1));
    expect(lastMap().opts).toMatchObject({ cooperativeGestures: false, dragPan: false });
    vi.unstubAllGlobals();
  });

  // L13: スタイルやタイルが取れないとき、代替表示（距離・時間とルートの線）
  it('L13: スタイルが取れなかった（error）ら、距離・時間とルートの線の代替表示にして、地図を片付ける', async () => {
    render(<RouteMap route={ROUTE} distanceM={5200} durationS={1930} />);
    await waitFor(() => expect(h.FakeMap.instances).toHaveLength(1));
    const map = lastMap();
    map.handlers.error({ error: new Error('style 503') });
    expect(await screen.findByRole('status')).toHaveTextContent(DETAIL_MESSAGES.mapUnavailable);
    expect(screen.getByTestId('map-fallback-stats')).toHaveTextContent('5.2km ・ 32:10');
    const sketch = screen.getByTestId('route-sketch');
    expect(sketch.querySelectorAll('polyline')).toHaveLength(1);
    expect(sketch.querySelectorAll('circle')).toHaveLength(2);
    expect(map.remove).toHaveBeenCalledTimes(1);
  });

  it('L13: 前回のルートがあれば、代替の線画にも点線で出す。距離・時間が無ければ数字は出さない', async () => {
    render(<RouteMap route={ROUTE} ghost={{ type: 'LineString', coordinates: [[139.7, 35.6], [139.8, 35.8]] }} />);
    await waitFor(() => expect(h.FakeMap.instances).toHaveLength(1));
    lastMap().handlers.error({ error: new Error('x') });
    const sketch = await screen.findByTestId('route-sketch');
    expect(sketch.querySelectorAll('polyline')).toHaveLength(2);
    expect(sketch.querySelector('polyline[stroke-dasharray]')).not.toBeNull();
    expect(screen.queryByTestId('map-fallback-stats')).not.toBeInTheDocument();
  });

  it('L13: タイルのエラーが続けて上限に達したら代替表示。1〜2回や、描き終えたあとの数え直しでは地図のまま', async () => {
    render(<RouteMap route={ROUTE} />);
    await waitFor(() => expect(h.FakeMap.instances).toHaveLength(1));
    const map = lastMap();
    for (let i = 0; i < TILE_ERROR_LIMIT - 1; i++) map.handlers.error({ tile: {}, sourceId: 'openmaptiles' });
    map.handlers.idle();
    map.handlers.error({ tile: {}, sourceId: 'openmaptiles' });
    expect(screen.queryByTestId('route-sketch')).not.toBeInTheDocument();
    for (let i = 0; i < TILE_ERROR_LIMIT; i++) map.handlers.error({ tile: {}, sourceId: 'openmaptiles' });
    expect(await screen.findByTestId('route-sketch')).toBeInTheDocument();
  });

  // A07-9: 操作案内（Use Ctrl + scroll to zoom the map など）を日本語にする
  it('操作案内を日本語（locale）で渡す', async () => {
    render(<RouteMap route={ROUTE} />);
    await waitFor(() => expect(h.FakeMap.instances).toHaveLength(1));
    expect(lastMap().opts.locale).toEqual(MAP_LOCALE_JA);
  });

  it('読み込みが終わったら、ルートの線とスタート・ゴールの点を足し、全体が入るよう範囲を合わせる', async () => {
    render(<RouteMap route={ROUTE} />);
    await waitFor(() => expect(h.FakeMap.instances).toHaveLength(1));
    const map = lastMap();
    expect(map.layers).toHaveLength(0); // まだ読み込み前は何も足さない
    map.handlers.load();

    expect(map.sources['route']).toMatchObject({ type: 'geojson', data: { type: 'Feature', geometry: ROUTE } });
    expect(map.sources['route-ends']).toMatchObject({ type: 'geojson', data: { type: 'FeatureCollection' } });
    expect(map.layers.map((l) => [l.id, l.type, l.source])).toEqual([
      ['route-line', 'line', 'route'],
      ['route-ends', 'circle', 'route-ends'],
    ]);
    expect(map.fitBounds).toHaveBeenCalledTimes(1);
    expect(map.fitBounds.mock.calls[0][0]).toEqual([
      [139.7, 35.6],
      [139.8, 35.7],
    ]);
    // 点が少ない・短いルートで寄りすぎない（maxZoom）。余白（padding）がある
    expect(map.fitBounds.mock.calls[0][1]).toMatchObject({ maxZoom: expect.any(Number), padding: expect.any(Number), animate: false });
  });

  describe('地図ゴースト（F-17: 前回のルートを点線で重ねる）', () => {
    const GHOST = { type: 'LineString' as const, coordinates: [[139.65, 35.62], [139.7, 35.75], [139.72, 35.8]] as [number, number][] };

    it('前回のルートの線を、今回の線より下（先）に足す。点線で、スタート・ゴールの点は今回だけ', async () => {
      render(<RouteMap route={ROUTE} ghost={GHOST} />);
      await waitFor(() => expect(h.FakeMap.instances).toHaveLength(1));
      const map = lastMap();
      map.handlers.load();
      expect(map.sources['ghost']).toMatchObject({ type: 'geojson', data: { type: 'Feature', geometry: GHOST } });
      expect(map.layers.map((l) => [l.id, l.source])).toEqual([
        ['ghost-line', 'ghost'],
        ['route-line', 'route'],
        ['route-ends', 'route-ends'],
      ]);
      expect(map.layers[0]).toMatchObject({ paint: { 'line-dasharray': expect.any(Array) } });
    });

    it('今回と前回の両方が入る範囲に合わせる', async () => {
      render(<RouteMap route={ROUTE} ghost={GHOST} />);
      await waitFor(() => expect(h.FakeMap.instances).toHaveLength(1));
      const map = lastMap();
      map.handlers.load();
      expect(map.fitBounds.mock.calls[0][0]).toEqual([
        [139.65, 35.6],
        [139.8, 35.8],
      ]);
    });

    it('前回がなければ、前回の線は足さない（従来どおり）', async () => {
      render(<RouteMap route={ROUTE} />);
      await waitFor(() => expect(h.FakeMap.instances).toHaveLength(1));
      const map = lastMap();
      map.handlers.load();
      expect(map.sources['ghost']).toBeUndefined();
      expect(map.layers.map((l) => l.id)).toEqual(['route-line', 'route-ends']);
    });

    it('地図の名前（aria-label）に、点線が前回だと書く', async () => {
      render(<RouteMap route={ROUTE} ghost={GHOST} />);
      expect(await screen.findByRole('img', { name: DETAIL_MESSAGES.mapLabelWithGhost })).toBeInTheDocument();
    });
  });

  it('画面を離れるときに地図を片付ける（remove）。入れ物ごと残さない', async () => {
    const { unmount } = render(<RouteMap route={ROUTE} />);
    await waitFor(() => expect(h.FakeMap.instances).toHaveLength(1));
    const map = lastMap();
    unmount();
    expect(map.remove).toHaveBeenCalledTimes(1);
  });

  it('読み込みが終わる前に画面を離れたら、地図を作らない（作ったら片付ける）', async () => {
    const { unmount } = render(<RouteMap route={ROUTE} />);
    unmount();
    await new Promise((r) => setTimeout(r, 20));
    for (const m of h.FakeMap.instances) expect(m.remove).toHaveBeenCalled();
  });

  it('地図を作れない環境（WebGL なし等）では、地図の代わりに理由を一言出す。落ちない', async () => {
    h.FakeMap.failWith = new Error('Failed to initialize WebGL');
    render(<RouteMap route={ROUTE} />);
    expect(await screen.findByRole('status')).toHaveTextContent(DETAIL_MESSAGES.mapUnavailable);
    expect(screen.queryByRole('img', { name: DETAIL_MESSAGES.mapLabel })).not.toBeInTheDocument();
  });

  it('route が変わったら、前の地図を片付けて作り直す', async () => {
    const { rerender } = render(<RouteMap route={ROUTE} />);
    await waitFor(() => expect(h.FakeMap.instances).toHaveLength(1));
    const first = lastMap();
    rerender(<RouteMap route={{ ...ROUTE, coordinates: [[140, 36], [140.1, 36.1]] }} />);
    await waitFor(() => expect(h.FakeMap.instances).toHaveLength(2));
    expect(first.remove).toHaveBeenCalledTimes(1);
  });
});
