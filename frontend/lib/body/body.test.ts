import { FORBIDDEN_WORDS } from '@/lib/forbidden-words';
import { ACTIVE_OPTIONS, BODY_MESSAGES, chartShape, FAVORITE_OPTIONS, formatDelta, guessWeight, startingWeight, parseHeightText, parseWeightText } from './body';

describe('parseWeightText（体重 20〜300・小数1桁まで）', () => {
  it.each([
    ['20', 20],
    ['300', 300],
    ['70.2', 70.2],
    [' 70 ', 70],
  ])('「%s」は %d', (text, expected) => {
    expect(parseWeightText(text)).toBe(expected);
  });
  it.each(['19.9', '300.1', '70.25', '70.', '.5', '', 'abc', '-70', '7e1'])('「%s」は null', (text) => {
    expect(parseWeightText(text)).toBeNull();
  });
});

describe('parseHeightText（身長 100〜250）', () => {
  it.each([
    ['100', 100],
    ['250', 250],
    ['170.5', 170.5],
  ])('「%s」は %d', (text, expected) => {
    expect(parseHeightText(text)).toBe(expected);
  });
  it.each(['99.9', '250.1', '', 'x'])('「%s」は null', (text) => {
    expect(parseHeightText(text)).toBeNull();
  });
});

describe('formatDelta', () => {
  it('増えたら +・減ったら -・同じなら ±0・無ければ —', () => {
    expect(formatDelta(0.5)).toBe('+0.5kg');
    expect(formatDelta(-0.5)).toBe('-0.5kg');
    expect(formatDelta(0)).toBe('±0kg');
    expect(formatDelta(null)).toBe('—');
  });
});

describe('chartShape', () => {
  it('0件は null', () => {
    expect(chartShape([])).toBeNull();
  });
  it('1件なら点は横の中央', () => {
    const s = chartShape([{ date: '2026-11-18', kg: 70, avg7: 70 }], 320, 160)!;
    expect(s.dots).toHaveLength(1);
    expect(s.dots[0].x).toBe(160);
  });
  it('日付の間隔どおりに横へ並ぶ（11/10・11/11・11/20 → 最初と最後が両端、真ん中は 1/10）', () => {
    const s = chartShape(
      [
        { date: '2026-11-10', kg: 70, avg7: 70 },
        { date: '2026-11-11', kg: 71, avg7: 70.5 },
        { date: '2026-11-20', kg: 72, avg7: 71 },
      ],
      320,
      160,
      16,
    )!;
    expect(s.dots[0].x).toBe(16);
    expect(s.dots[2].x).toBe(304);
    expect(s.dots[1].x).toBeCloseTo(16 + (288 * 1) / 10, 1);
  });
  it('重いほど上（y が小さい）。7日平均の線は平均のある点だけを結ぶ', () => {
    const s = chartShape([
      { date: '2026-11-10', kg: 70, avg7: null },
      { date: '2026-11-11', kg: 72, avg7: 71 },
    ])!;
    expect(s.dots[1].y).toBeLessThan(s.dots[0].y);
    expect(s.avgPath.startsWith('M')).toBe(true);
    expect(s.avgPath.match(/L/g)).toBeNull();
  });
});

describe('文言', () => {
  // 文を作る関数（身長を入れて文にするもの）は、例の値で文にして調べる
  const texts = [...Object.values(BODY_MESSAGES).map((v) => (typeof v === 'function' ? v(170) : v)), ...FAVORITE_OPTIONS.map((o) => o.label), ...ACTIVE_OPTIONS.map((o) => o.label)];
  it.each(texts)('「%s」は使ってはいけない語を含まない', (text) => {
    for (const word of FORBIDDEN_WORDS) expect(text).not.toContain(word);
  });
  it('判定の言葉（肥満・標準・やせ・普通体重）を含まない', () => {
    for (const text of texts) expect(text).not.toMatch(/肥満|標準|やせ|痩せ|普通体重|太り/);
  });
});

describe('guessWeight（身長からの体重の目安。BMI 22。L11）', () => {
  it.each([
    [170, 63.6], // 22 × 1.7² = 63.58
    [160, 56.3], // 22 × 1.6² = 56.32
    [180, 71.3], // 22 × 1.8² = 71.28
  ])('%icm → %skg', (cm, kg) => {
    expect(guessWeight(cm)).toBe(kg);
  });

  it('身長が無い・範囲（100〜250）の外なら 60kg', () => {
    expect(guessWeight(null)).toBe(60);
    expect(guessWeight(99)).toBe(60);
    expect(guessWeight(251)).toBe(60);
  });

  it('範囲の端（100cm・250cm）でも体重の範囲（20〜300）に収まる', () => {
    expect(guessWeight(100)).toBe(22);
    expect(guessWeight(250)).toBe(137.5);
  });
});

describe('startingWeight（ルーラーの始まりの値）', () => {
  it('今日の体重 → 前回の体重 → 身長からの目安 → 60kg の順', () => {
    expect(startingWeight(61.2, 62, 170)).toBe(61.2);
    expect(startingWeight(undefined, 62, 170)).toBe(62);
    expect(startingWeight(undefined, null, 170)).toBe(guessWeight(170));
    expect(startingWeight(undefined, undefined, null)).toBe(60);
  });
});
