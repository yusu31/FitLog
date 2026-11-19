import { FORBIDDEN_WORDS } from '@/lib/forbidden-words';
import { ACTIVE_OPTIONS, BODY_MESSAGES, chartShape, FAVORITE_OPTIONS, formatDelta, parseHeightText, parseWeightText } from './body';

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
  const texts = [...Object.values(BODY_MESSAGES), ...FAVORITE_OPTIONS.map((o) => o.label), ...ACTIVE_OPTIONS.map((o) => o.label)];
  it.each(texts)('「%s」は使ってはいけない語を含まない', (text) => {
    for (const word of FORBIDDEN_WORDS) expect(text).not.toContain(word);
  });
  it('判定の言葉（肥満・標準・やせ・普通体重）を含まない', () => {
    for (const text of texts) expect(text).not.toMatch(/肥満|標準|やせ|痩せ|普通体重|太り/);
  });
});
