import { describe, expect, it } from 'vitest';
import { JAPAN_ROUTE, TOTAL_KM, locateOnRoute, nextText, trekText } from '@/lib/japan-route';

// 日本縦断（F-28。docs/testing-design.md 3-17）の現在地の計算。ルートは鹿児島から稚内まで、累計 km の昇順

describe('JAPAN_ROUTE（ルートの定義）', () => {
  it('先頭は 0km、累計 km は厳密に増え、地点は10以上ある', () => {
    expect(JAPAN_ROUTE[0].km).toBe(0);
    expect(JAPAN_ROUTE.length).toBeGreaterThanOrEqual(10);
    for (let i = 1; i < JAPAN_ROUTE.length; i++) expect(JAPAN_ROUTE[i].km).toBeGreaterThan(JAPAN_ROUTE[i - 1].km);
  });
});

describe('locateOnRoute（累計距離から今いる場所を出す）', () => {
  it('0m は出発点（鹿児島）', () => {
    const p = locateOnRoute(0);
    expect(p.name).toBe('鹿児島');
    expect([p.x, p.y]).toEqual([JAPAN_ROUTE[0].x, JAPAN_ROUTE[0].y]);
    expect(p.lap).toBe(1);
  });
  it('地点の手前（境界の1m前）は直前の地点の名前のまま', () => {
    const second = JAPAN_ROUTE[1];
    expect(locateOnRoute(second.km * 1000 - 1).name).toBe('鹿児島');
  });
  it('地点ちょうど（境界）で次の地点の名前になり、座標もその地点と一致する', () => {
    const second = JAPAN_ROUTE[1];
    const p = locateOnRoute(second.km * 1000);
    expect(p.name).toBe(second.name);
    expect([p.x, p.y]).toEqual([second.x, second.y]);
  });
  it('2地点の真ん中では座標も真ん中（線形に補間する）', () => {
    const [a, b] = [JAPAN_ROUTE[0], JAPAN_ROUTE[1]];
    const p = locateOnRoute(((a.km + b.km) / 2) * 1000);
    expect(p.x).toBeCloseTo((a.x + b.x) / 2);
    expect(p.y).toBeCloseTo((a.y + b.y) / 2);
  });
  it('終点（稚内）の 1m 手前は、まだ1周目の稚内の手前（札幌のあたり）', () => {
    const p = locateOnRoute(TOTAL_KM * 1000 - 1);
    expect(p.lap).toBe(1);
    expect(p.name).toBe('札幌');
  });
  it('終点ちょうどで1周を達成し、2周目の出発点（鹿児島）に戻る', () => {
    const p = locateOnRoute(TOTAL_KM * 1000);
    expect(p.lap).toBe(2);
    expect(p.name).toBe('鹿児島');
    expect([p.x, p.y]).toEqual([JAPAN_ROUTE[0].x, JAPAN_ROUTE[0].y]);
  });
  it('2周目も同じ道を進む（1周ぶん引いた距離と同じ場所）。3周目以降も同様', () => {
    const base = locateOnRoute(1_000_000);
    const second = locateOnRoute(1_000_000 + TOTAL_KM * 1000);
    const third = locateOnRoute(1_000_000 + 2 * TOTAL_KM * 1000);
    expect([second.name, second.x, second.y]).toEqual([base.name, base.x, base.y]);
    expect([third.name, third.x, third.y]).toEqual([base.name, base.x, base.y]);
    expect([base.lap, second.lap, third.lap]).toEqual([1, 2, 3]);
  });
  it('負の値や NaN は 0 として扱う', () => {
    expect(locateOnRoute(-5).name).toBe('鹿児島');
    expect(locateOnRoute(Number.NaN).name).toBe('鹿児島');
  });
  it('通った地点の数（passed）は、出発点を含めて今いる区間の手前まで', () => {
    expect(locateOnRoute(0).passed).toBe(1);
    expect(locateOnRoute(JAPAN_ROUTE[1].km * 1000).passed).toBe(2);
  });
});

describe('nextText（次の地点まで。ゴールまでの残りは出さない）', () => {
  it('次の地点の名前と、そこまでの距離（km、小数1桁）を言う', () => {
    expect(nextText(locateOnRoute(12300))).toBe('次の福岡まで 257.7km');
  });
  it('地点ちょうどに着いたら、そのひとつ先の地点を言う（0km とは言わない）', () => {
    expect(nextText(locateOnRoute(270_000))).toBe('次の広島まで 290.0km');
  });
  it('1周の最後の区間では稚内、1周したら2周目の最初の地点（福岡）を言う', () => {
    expect(nextText(locateOnRoute(2_900_000))).toContain('次の稚内まで');
    expect(nextText(locateOnRoute(3_000_000))).toBe('次の福岡まで 270.0km');
  });
  it('「あと」「残り」「ゴール」は言わない', () => {
    expect(nextText(locateOnRoute(500_000))).not.toMatch(/あと|残り|ゴール/);
  });
  it('距離は0.1kmの単位に切り上げる（手前なのに 0.0km と出さない）', () => {
    expect(nextText(locateOnRoute(269_990))).toBe('次の福岡まで 0.1km');
  });
});

describe('trekText（文言）', () => {
  it('「あと◯km」を出さず、走った距離と今いる場所だけを言う', () => {
    const t = trekText(12300, locateOnRoute(12300));
    expect(t).toContain('12.3');
    expect(t).toContain('鹿児島');
    expect(t).not.toMatch(/あと|残り/);
  });
  it('1周目は「達成」と言わない。1周すると達成の回数と何周目かを言う（「あと」は出さない）', () => {
    expect(trekText(12300, locateOnRoute(12300))).not.toMatch(/達成|周目/);
    const t = trekText(4_000_000, locateOnRoute(4_000_000));
    expect(t).toContain('1回達成');
    expect(t).toContain('2周目');
    expect(t).toContain('名古屋'); // 4000-3000=1000km は名古屋の地点ちょうど
    expect(t).not.toMatch(/あと|残り/);
  });
  it('3周すれば「2回達成」「3周目」', () => {
    const t = trekText(7_000_000, locateOnRoute(7_000_000));
    expect(t).toContain('2回達成');
    expect(t).toContain('3周目');
  });
});
