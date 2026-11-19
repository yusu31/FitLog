import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { locateOnRoute } from '@/lib/japan-route';
import { MAP_LOCALE_JA } from '@/lib/map/locale-ja';
import { JapanMap } from './japan-map';

// MapLibre 本体は WebGL が要るので、見せかけの Map に差し替える（作ったときの設定と、読み込めなかったときの代わりの表示を確かめる）
const mapOptions = vi.fn();
const addControl = vi.fn();
const loadMapLibre = vi.fn();
vi.mock('@/lib/map/load-maplibre', () => ({ loadMapLibre: () => loadMapLibre() }));

class FakeMap {
  constructor(opts: unknown) {
    mapOptions(opts);
  }
  addControl = addControl;
  on = vi.fn();
  remove = vi.fn();
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
  loadMapLibre.mockReset().mockResolvedValue({ Map: FakeMap, NavigationControl: FakeNav });
  Element.prototype.scrollIntoView = scrollIntoView;
  window.location.hash = '';
});
afterEach(cleanup);

describe('JapanMap（日本縦断の地図）', () => {
  it('A07-6: 着地先の印（id="japan-trek"）が地図の枠に付いている', () => {
    render(<JapanMap pos={pos} />);
    expect(screen.getByRole('img').closest('#japan-trek')).not.toBeNull();
  });

  it('A07-6: URL に #japan-trek が付いているとき、地図の位置までスクロールする', async () => {
    window.location.hash = '#japan-trek';
    render(<JapanMap pos={pos} />);
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalled());
  });

  it('A07-6: #japan-trek が無いときは、勝手にスクロールしない', async () => {
    render(<JapanMap pos={pos} />);
    await waitFor(() => expect(mapOptions).toHaveBeenCalled());
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
});
