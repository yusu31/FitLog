import { JAPAN_ROUTE, locateOnRoute } from '@/lib/japan-route';
import { trekGeo } from './trek-geo';

// 日本縦断の地図に描くデータ。座標は [経度, 緯度]
describe('trekGeo', () => {
  it('全体の線は全地点、通った線は出発点〜今いる位置（通過済みの地点＋現在地）', () => {
    const pos = locateOnRoute(300_000); // 福岡(270km)を過ぎたところ
    const g = trekGeo(pos);
    expect(g.all.geometry.coordinates).toHaveLength(JAPAN_ROUTE.length);
    expect(g.done.geometry.coordinates).toHaveLength(pos.passed + 1);
    expect(g.done.geometry.coordinates[0]).toEqual([JAPAN_ROUTE[0].lng, JAPAN_ROUTE[0].lat]);
    expect(g.done.geometry.coordinates.at(-1)).toEqual([pos.lng, pos.lat]);
    expect(g.here.geometry.coordinates).toEqual([pos.lng, pos.lat]);
    expect(g.cities.features).toHaveLength(JAPAN_ROUTE.length);
  });
  it('今いる位置は、経度・緯度の順で、福岡と広島のあいだにある', () => {
    const { here } = trekGeo(locateOnRoute(400_000));
    const [lng, lat] = here.geometry.coordinates;
    expect(lng).toBeGreaterThan(130.402);
    expect(lng).toBeLessThan(132.46);
    expect(lat).toBeGreaterThan(33.59);
    expect(lat).toBeLessThan(34.397);
  });
});
