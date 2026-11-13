import { describe, expect, it } from 'vitest';
import { JAPAN_ROUTE, locateOnRoute, trekText } from '@/lib/japan-route';

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
    expect(p.reached).toBe(false);
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
  it('終点を超えても終点（稚内）にとどまり、reached が true になる', () => {
    const last = JAPAN_ROUTE.at(-1)!;
    const p = locateOnRoute((last.km + 500) * 1000);
    expect(p.name).toBe(last.name);
    expect([p.x, p.y]).toEqual([last.x, last.y]);
    expect(p.reached).toBe(true);
  });
  it('終点ちょうども reached', () => {
    expect(locateOnRoute(JAPAN_ROUTE.at(-1)!.km * 1000).reached).toBe(true);
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

describe('trekText（文言）', () => {
  it('「あと◯km」を出さず、走った距離と今いる場所だけを言う', () => {
    const t = trekText(12300, locateOnRoute(12300));
    expect(t).toContain('12.3');
    expect(t).toContain('鹿児島');
    expect(t).not.toMatch(/あと|残り/);
  });
  it('終点に着いたら「縦断達成」と言う（それでも「あと」は出さない）', () => {
    const t = trekText(4_000_000, locateOnRoute(4_000_000));
    expect(t).toContain('縦断');
    expect(t).not.toMatch(/あと|残り/);
  });
});
