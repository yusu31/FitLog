import {
  REST_DEFAULT_S,
  REST_MAX_S,
  REST_MIN_S,
  clampRestSeconds,
  formatRest,
  readRestSeconds,
  remainingSeconds,
  stepRestSeconds,
  writeRestSeconds,
} from './rest-timer';

describe('休憩タイマーの決まり（F-34）', () => {
  beforeEach(() => localStorage.clear());

  // T-REST-01: 残り秒は終了時刻から出す（裏に回って画面が止まっていても狂わない）。境界: ちょうど終了・過ぎた・端数
  it.each([
    [10_000, 0, 10],
    [10_000, 9_001, 1],
    [10_000, 10_000, 0],
    [10_000, 25_000, 0],
    [10_500, 0, 11],
  ])('終了 %i ms・いま %i ms → 残り %i 秒', (endAt, now, expected) => {
    expect(remainingSeconds(endAt, now)).toBe(expected);
  });

  // T-REST-02: 長さは 15〜600 秒・15 秒刻み。端で止まる（境界値）
  it('±15 秒で動かし、15 と 600 の端で止まる', () => {
    expect(stepRestSeconds(90, 1)).toBe(105);
    expect(stepRestSeconds(90, -1)).toBe(75);
    expect(stepRestSeconds(REST_MIN_S, -1)).toBe(REST_MIN_S);
    expect(stepRestSeconds(REST_MAX_S, 1)).toBe(REST_MAX_S);
    expect(stepRestSeconds(REST_MIN_S + 15, -1)).toBe(REST_MIN_S);
  });
  it('範囲外・数でない値は範囲に収める（数でないときは既定）', () => {
    expect(clampRestSeconds(0)).toBe(REST_MIN_S);
    expect(clampRestSeconds(9999)).toBe(REST_MAX_S);
    expect(clampRestSeconds(Number.NaN)).toBe(REST_DEFAULT_S);
    expect(clampRestSeconds(100)).toBe(105);
  });

  // T-REST-03: 端末に保存した長さ。無い・壊れた・範囲外は既定の 90 秒
  it('保存した長さを読む。書いたら次に読める', () => {
    writeRestSeconds(120);
    expect(readRestSeconds()).toBe(120);
  });
  it.each([null, 'abc', '', '5', '601', '-30', 'NaN'])('保存が %s のときは既定の 90 秒', (raw) => {
    if (raw !== null) localStorage.setItem('fitlog:rest-seconds', raw);
    expect(readRestSeconds()).toBe(REST_DEFAULT_S);
  });
  it('端末に保存できなくても落ちない（既定の 90 秒・書き込みは黙って失敗）', () => {
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(readRestSeconds()).toBe(REST_DEFAULT_S);
    expect(() => writeRestSeconds(60)).not.toThrow();
    get.mockRestore();
    set.mockRestore();
  });

  it('残りの見せ方は 分:秒', () => {
    expect(formatRest(90)).toBe('1:30');
    expect(formatRest(9)).toBe('0:09');
    expect(formatRest(0)).toBe('0:00');
    expect(formatRest(600)).toBe('10:00');
  });
});
