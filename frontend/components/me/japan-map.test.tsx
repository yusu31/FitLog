import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { locateOnRoute } from '@/lib/japan-route';
import { MAP_LOCALE_JA } from '@/lib/map/locale-ja';
import { TILE_ERROR_LIMIT } from '@/lib/map/map-failure';
import { JapanMap, SCROLL_FALLBACK_MS } from './japan-map';

// MapLibre 本体は WebGL が要るので、見せかけの Map に差し替える（作ったときの設定と、読み込めなかったときの代わりの表示を確かめる）
const mapOptions = vi.fn();
const addControl = vi.fn();
const loadMapLibre = vi.fn();
vi.mock('@/lib/map/load-maplibre', () => ({ loadMapLibre: () => loadMapLibre() }));

const handlers: Record<string, (e?: unknown) => void> = {};
const addLayer = vi.fn();
const remove = vi.fn();
class FakeMap {
  constructor(opts: unknown) {
    mapOptions(opts);
  }
  addControl = addControl;
  addSource = vi.fn();
  addLayer = addLayer;
  on(event: string, cb: (e?: unknown) => void) {
    handlers[event] = cb;
    return this;
  }
  remove = remove;
}
class FakeNav {
  constructor(public opts: unknown) {}
}

const pos = locateOnRoute(300_000);
const scrollIntoView = vi.fn();

beforeEach(() => {
  mapOptions.mockClear();
  addControl.mockClear();
  scrollIntoView.mockClear();
  addLayer.mockClear();
  remove.mockClear();
  for (const k of Object.keys(handlers)) delete handlers[k];
  loadMapLibre.mockReset().mockResolvedValue({ Map: FakeMap, NavigationControl: FakeNav });
  Element.prototype.scrollIntoView = scrollIntoView;
  window.location.hash = '';
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('JapanMap（日本縦断の地図）', () => {
  it('A07-6: 着地先の印（id="japan-trek"）が地図の枠に付いている', () => {
    render(<JapanMap pos={pos} />);
    expect(screen.getByRole('img').closest('#japan-trek')).not.toBeNull();
  });

  it('A07-6・L6: URL に #japan-trek が付いているとき、地図を描き終えてから、地図の位置までスクロールする', async () => {
    window.location.hash = '#japan-trek';
    render(<JapanMap pos={pos} />);
    await waitFor(() => expect(handlers.load).toBeDefined());
    expect(scrollIntoView).not.toHaveBeenCalled(); // 描く前は動かない
    handlers.load();
    expect(addLayer).toHaveBeenCalled();
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    handlers.load();
    expect(scrollIntoView).toHaveBeenCalledTimes(1); // 1回だけ
  });

  it('L6: 地図がいつまでも描き終わらなくても、一定時間で地図の位置へ動く（保険）', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    window.location.hash = '#japan-trek';
    render(<JapanMap pos={pos} />);
    expect(scrollIntoView).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(SCROLL_FALLBACK_MS + 100);
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it('A07-6: #japan-trek が無いときは、勝手にスクロールしない', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<JapanMap pos={pos} />);
    await waitFor(() => expect(handlers.load).toBeDefined());
    handlers.load();
    await vi.advanceTimersByTimeAsync(SCROLL_FALLBACK_MS + 100);
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it('A07-9: 操作案内を日本語（locale）で渡す', async () => {
    render(<JapanMap pos={pos} />);
    await waitFor(() => expect(mapOptions).toHaveBeenCalled());
    expect(mapOptions.mock.calls[0][0]).toMatchObject({ locale: MAP_LOCALE_JA });
  });

  it('A07-4/8（保険）: 地図を読み込めないときは、代わりの一言を出す（印は残る）', async () => {
    loadMapLibre.mockRejectedValue(new Error('no webgl'));
    render(<JapanMap pos={pos} />);
    expect(await screen.findByRole('status')).toHaveTextContent('地図は この端末では出せませんでした');
    expect(document.getElementById('japan-trek')).not.toBeNull();
  });

  // L13: スタイルが取れない・タイルが続けて取れないときは、日本の線画の代替表示にする
  it('L13: 地図のスタイルが取れなかった（error）ら、代替表示（日本の線画）にして、地図を片付ける', async () => {
    render(<JapanMap pos={pos} />);
    await waitFor(() => expect(handlers.error).toBeDefined());
    handlers.error({ error: new Error('style 503') });
    expect(await screen.findByRole('status')).toHaveTextContent('地図は この端末では出せませんでした');
    expect(screen.getByTestId('route-sketch')).toBeInTheDocument();
    expect(remove).toHaveBeenCalledTimes(1);
    expect(document.getElementById('japan-trek')).not.toBeNull();
  });

  it('L13: タイルのエラーが1〜2回なら地図のまま、続けて上限に達したら代替表示にする。描き終えると数え直す', async () => {
    render(<JapanMap pos={pos} />);
    await waitFor(() => expect(handlers.error).toBeDefined());
    for (let i = 0; i < TILE_ERROR_LIMIT - 1; i++) handlers.error({ tile: {}, sourceId: 'openmaptiles' });
    handlers.idle();
    handlers.error({ tile: {}, sourceId: 'openmaptiles' });
    expect(screen.queryByTestId('route-sketch')).not.toBeInTheDocument();
    for (let i = 0; i < TILE_ERROR_LIMIT; i++) handlers.error({ tile: {}, sourceId: 'openmaptiles' });
    expect(await screen.findByTestId('route-sketch')).toBeInTheDocument();
  });

  // L7: 触る端末は、1本指がページのスクロール（dragPan を切る）・Ctrl の案内を出さない。PC は今のまま
  it('L7: 触る端末（pointer: coarse）では cooperativeGestures を使わず、1本指のドラッグを切る', async () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q === '(pointer: coarse)' }));
    render(<JapanMap pos={pos} />);
    await waitFor(() => expect(mapOptions).toHaveBeenCalled());
    expect(mapOptions.mock.calls[0][0]).toMatchObject({ cooperativeGestures: false, dragPan: false });
  });

  it('L7: PC（マウス）は今のまま cooperativeGestures で、dragPan は切らない', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    render(<JapanMap pos={pos} />);
    await waitFor(() => expect(mapOptions).toHaveBeenCalled());
    const opts = mapOptions.mock.calls[0][0] as Record<string, unknown>;
    expect(opts.cooperativeGestures).toBe(true);
    expect(opts).not.toHaveProperty('dragPan');
  });
});
