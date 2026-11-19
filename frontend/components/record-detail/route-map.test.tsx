import { cleanup, render, waitFor, screen } from '@testing-library/react';
import { DETAIL_MESSAGES } from '@/lib/messages';
import { MAP_LOCALE_JA } from '@/lib/map/locale-ja';
import { RouteMap } from './route-map';

const mapOptions = vi.fn();
const loadMapLibre = vi.fn();
vi.mock('@/lib/map/load-maplibre', () => ({ loadMapLibre: () => loadMapLibre() }));

class FakeMap {
  constructor(opts: unknown) {
    mapOptions(opts);
  }
  addControl = vi.fn();
  on = vi.fn();
  remove = vi.fn();
}
class FakeNav {}

const ROUTE = { type: 'LineString' as const, coordinates: [[0, 0], [0, 0.01]] };

beforeEach(() => {
  mapOptions.mockClear();
  loadMapLibre.mockReset().mockResolvedValue({ Map: FakeMap, NavigationControl: FakeNav });
});
afterEach(cleanup);

describe('RouteMap（ランのルートの地図）', () => {
  it('A07-9: 操作案内を日本語（locale）で渡す', async () => {
    render(<RouteMap route={ROUTE} />);
    await waitFor(() => expect(mapOptions).toHaveBeenCalled());
    expect(mapOptions.mock.calls[0][0]).toMatchObject({ locale: MAP_LOCALE_JA });
  });

  it('A07-4（保険）: 地図を読み込めないときは、代わりの一言を出す', async () => {
    loadMapLibre.mockRejectedValue(new Error('no webgl'));
    render(<RouteMap route={ROUTE} />);
    expect(await screen.findByRole('status')).toHaveTextContent(DETAIL_MESSAGES.mapUnavailable);
  });
});
