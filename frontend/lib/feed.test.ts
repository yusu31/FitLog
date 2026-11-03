import { COMMENT_MAX, QUICK_COMMENTS, STAMP_KEYS, STAMP_LABELS, describeItem, describeTotals, formatVolumeKg, normalizeComment, stampState } from './feed';

describe('スタンプと定型コメントの決まり（F-10）', () => {
  it('筋トレ・ランは4種、休みは2種。休みに筋トレ用のスタンプは付かない', () => {
    expect(STAMP_KEYS.workout).toEqual(['nice', 'fire', 'clap', 'smile']);
    expect(STAMP_KEYS.run).toEqual(['nice', 'fire', 'clap', 'smile']);
    expect(STAMP_KEYS.rest).toEqual(['rest_slow', 'rest_again']);
  });
  it('すべてのスタンプに表示名がある', () => {
    for (const key of Object.values(STAMP_KEYS).flat()) expect(STAMP_LABELS[key]).toBeTruthy();
    expect(STAMP_LABELS.rest_again).toBe('またあした');
  });
  it('定型コメントは 50 字以内で、休みには休み用が出る', () => {
    expect(QUICK_COMMENTS.rest).toEqual(['ゆっくり休んでね', 'また一緒にやろう']);
    for (const body of Object.values(QUICK_COMMENTS).flat()) expect(normalizeComment(body)).toBe(body);
  });
});

describe('normalizeComment（境界値: 0・1・50・51字、空白だけ）', () => {
  it.each([
    ['', null],
    ['   ', null],
    ['\n\t', null],
    ['あ', 'あ'],
    ['  ナイス！  ', 'ナイス！'],
    ['あ'.repeat(COMMENT_MAX), 'あ'.repeat(COMMENT_MAX)],
    ['あ'.repeat(COMMENT_MAX + 1), null],
    ['😀'.repeat(COMMENT_MAX), '😀'.repeat(COMMENT_MAX)], // 絵文字1つも1字
    ['😀'.repeat(COMMENT_MAX + 1), null],
  ])('%j → %j', (input, expected) => {
    expect(normalizeComment(input)).toBe(expected);
  });
});

describe('describeTotals（週の合計）', () => {
  it('人数・総重量（桁区切り）・距離を整える', () => {
    expect(describeTotals({ recordedUserCount: 4, totalVolumeKg: 12400, totalDistanceM: 18000 })).toEqual({
      empty: false,
      recorded: '4人が記録',
      volume: '12,400kg',
      distance: '18.0km',
    });
  });
  it('だれも記録していない週は empty（0 人）', () => {
    expect(describeTotals({ recordedUserCount: 0, totalVolumeKg: 0, totalDistanceM: 0 }).empty).toBe(true);
  });
  it('1 人でも記録があれば empty ではない（境界）', () => {
    expect(describeTotals({ recordedUserCount: 1, totalVolumeKg: 0, totalDistanceM: 0 }).empty).toBe(false);
  });
  it('総重量は四捨五入する', () => {
    expect(formatVolumeKg(999.5)).toBe('1,000kg');
    expect(formatVolumeKg(0)).toBe('0kg');
  });
});

describe('describeItem（足跡の1行目）', () => {
  it('休みは「おやすみ」', () => {
    expect(describeItem({ kind: 'rest', exerciseNames: [] })).toEqual({ title: 'おやすみ', detail: '' });
  });
  it('ランは距離つき。run が無いときは距離を出さない', () => {
    expect(describeItem({ kind: 'run', exerciseNames: [], run: { distanceM: 5200, durationS: 1800 } })).toEqual({ title: 'ラン', detail: '5.2km' });
    expect(describeItem({ kind: 'run', exerciseNames: [] })).toEqual({ title: 'ラン', detail: '' });
  });
  it('筋トレは 0・1・3 種目で出し分ける', () => {
    expect(describeItem({ kind: 'workout', exerciseNames: [] })).toEqual({ title: '筋トレ', detail: '' });
    expect(describeItem({ kind: 'workout', exerciseNames: ['スクワット'] })).toEqual({ title: 'スクワット', detail: '' });
    expect(describeItem({ kind: 'workout', exerciseNames: ['スクワット', 'ベンチ', 'デッド'] })).toEqual({ title: 'スクワット', detail: 'ほか2種目' });
  });
});

describe('stampState', () => {
  const stamps = [
    { stampKey: 'nice' as const, count: 2, mine: 'r1' },
    { stampKey: 'fire' as const, count: 1, mine: null },
  ];
  it('付いているスタンプの数と自分の id を返す', () => {
    expect(stampState(stamps, 'nice')).toEqual({ count: 2, mine: 'r1' });
    expect(stampState(stamps, 'fire')).toEqual({ count: 1, mine: null });
  });
  it('付いていないスタンプは 0・mine なし', () => {
    expect(stampState(stamps, 'clap')).toEqual({ count: 0, mine: null });
    expect(stampState([], 'nice')).toEqual({ count: 0, mine: null });
  });
});
