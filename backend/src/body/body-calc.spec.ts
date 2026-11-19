import { avg7, bmi, deltaFromPrevious, estimateKcal, metsForRun, METS_WORKOUT, oneRepMax } from './body-calc.js';

// からだの計算（B14a）。境目の値を確かめる
describe('bmi', () => {
  it('体重 ÷ 身長(m)² を小数1桁で返す（70kg・170cm → 24.2）', () => {
    expect(bmi(70, 170)).toBe(24.2);
  });
  it('身長か体重が無ければ null', () => {
    expect(bmi(null, 170)).toBeNull();
    expect(bmi(70, null)).toBeNull();
  });
  it('身長が 0 以下は null（0 で割らない）', () => {
    expect(bmi(70, 0)).toBeNull();
  });
});

describe('avg7（最新の測定日を含む、さかのぼって7日間の平均）', () => {
  const rows = [
    { date: '2026-11-01', kg: 100 },
    { date: '2026-11-12', kg: 70 },
    { date: '2026-11-13', kg: 71 },
    { date: '2026-11-18', kg: 72 },
  ];
  it('11/18 の7日間は 11/12〜11/18。11/12 は含み、11/11 以前は含まない', () => {
    expect(avg7(rows, '2026-11-18')).toBe(71);
  });
  it('11/19 の7日間は 11/13〜11/19。11/12 が外れる', () => {
    expect(avg7(rows, '2026-11-19')).toBe(71.5);
  });
  it('7日間に1件も無ければ null', () => {
    expect(avg7(rows, '2026-12-31')).toBeNull();
  });
});

describe('deltaFromPrevious（前回の測定からの増減）', () => {
  it('最新 − 1つ前。小数1桁', () => {
    expect(deltaFromPrevious([{ date: '2026-11-17', kg: 70.2 }, { date: '2026-11-18', kg: 69.7 }])).toBe(-0.5);
  });
  it('1件だけなら null', () => {
    expect(deltaFromPrevious([{ date: '2026-11-18', kg: 70 }])).toBeNull();
  });
  it('0件なら null', () => {
    expect(deltaFromPrevious([])).toBeNull();
  });
});

describe('oneRepMax（Epley: 重量×(1+回数/30)）', () => {
  it('60kg×10回 → 80。12回までは目安ではない', () => {
    expect(oneRepMax(60, 10)).toEqual({ kg: 80, approximate: false });
    expect(oneRepMax(60, 12)).toEqual({ kg: 84, approximate: false });
  });
  it('13回からは「目安」', () => {
    expect(oneRepMax(60, 13)).toEqual({ kg: 86, approximate: true });
  });
  it('1回なら重さそのまま', () => {
    expect(oneRepMax(100, 1)).toEqual({ kg: 100, approximate: false });
  });
  it('重量 0（自重）は null', () => {
    expect(oneRepMax(0, 10)).toBeNull();
  });
});

describe('metsForRun（身体活動のメッツ表 改訂第2版（2024）の走る速さの区分。下限を含む）', () => {
  it('4.2km/h 未満は走ったとみなさず null', () => {
    expect(metsForRun(4.1)).toBeNull();
  });
  it('4.2km/h は 3.3', () => {
    expect(metsForRun(4.2)).toBe(3.3);
  });
  it('10km/h は 9.3（9.7 未満は 9.0 の区分、9.7 から 9.3）', () => {
    expect(metsForRun(9.6)).toBe(9.0);
    expect(metsForRun(9.7)).toBe(9.3);
    expect(metsForRun(10)).toBe(9.3);
  });
  it('19.4km/h 以上は 18.5', () => {
    expect(metsForRun(30)).toBe(18.5);
  });
});

describe('estimateKcal（メッツ×時間(h)×体重(kg)×1.05）', () => {
  it('3.5メッツ・1時間・60kg → 220.5 → 221', () => {
    expect(estimateKcal(METS_WORKOUT, 3600, 60)).toBe(221);
  });
  it('時間 0 や体重 0 は null', () => {
    expect(estimateKcal(3.5, 0, 60)).toBeNull();
    expect(estimateKcal(3.5, 3600, 0)).toBeNull();
  });
});
