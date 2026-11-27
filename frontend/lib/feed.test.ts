import { COMMENT_MAX, achievementChips, QUICK_COMMENTS, STAMP_KEYS, STAMP_LABELS, describeItem, describeTotals, formatVolumeKg, weekDividerLabel, normalizeComment, stampState, stampWhoLines } from './feed';

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
  it('投稿（動画とひとことだけ）は「投稿」', () => {
    expect(describeItem({ kind: 'post', exerciseNames: [] })).toEqual({ title: '投稿', detail: '' });
  });
  it('休みは「おやすみ」', () => {
    expect(describeItem({ kind: 'rest', exerciseNames: [] })).toEqual({ title: 'おやすみ', detail: '' });
  });
  it('ランは距離つき。run が無いときは距離を出さない', () => {
    expect(describeItem({ kind: 'run', exerciseNames: [] })).toEqual({ title: 'ラン', detail: '' });
  });
  // T-PEER-03（U13）: ランは距離・時間・ペースを出す。境界: 時間 0・距離 0 はその項目を出さない
  it('ランは距離・時間・ペースを「・」でつなぐ', () => {
    expect(describeItem({ kind: 'run', exerciseNames: [], run: { distanceM: 5200, durationS: 1930 } })).toEqual({
      title: 'ラン',
      detail: '5.2km・32:10・6:11/km',
    });
  });
  it('時間が 0 ならペースも出さず距離だけ（0 割りしない）', () => {
    expect(describeItem({ kind: 'run', exerciseNames: [], run: { distanceM: 5200, durationS: 0 } })).toEqual({ title: 'ラン', detail: '5.2km' });
  });
  it('距離が 0 なら時間だけ出す（ペースは出さない）', () => {
    expect(describeItem({ kind: 'run', exerciseNames: [], run: { distanceM: 0, durationS: 600 } })).toEqual({ title: 'ラン', detail: '0.0km・10:00' });
  });
  it('筋トレは 0・1・3 種目で出し分ける', () => {
    expect(describeItem({ kind: 'workout', exerciseNames: [] })).toEqual({ title: '筋トレ', detail: '' });
    expect(describeItem({ kind: 'workout', exerciseNames: ['スクワット'] })).toEqual({ title: 'スクワット', detail: '' });
    expect(describeItem({ kind: 'workout', exerciseNames: ['スクワット', 'ベンチ', 'デッド'] })).toEqual({ title: 'スクワット', detail: 'ほか2種目' });
  });
});

describe('stampState', () => {
  const stamps = [
    { stampKey: 'nice' as const, count: 2, mine: 'r1', by: [] },
    { stampKey: 'fire' as const, count: 1, mine: null, by: [] },
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

describe('stampWhoLines（だれが押したか。A04-2）', () => {
  const stamps = [
    { stampKey: 'nice' as const, count: 2, mine: 'r2', by: [{ id: 'u-hanako', name: 'はなこ' }, { id: 'me', name: 'わたし' }] },
    { stampKey: 'fire' as const, count: 1, mine: null, by: [{ id: 'u-taro', name: 'たろう' }] },
  ];
  it('スタンプごとに「名前・名前」の1行にする。自分は「あなた」、並びは押した順のまま', () => {
    expect(stampWhoLines(stamps, 'me')).toEqual(['ナイス はなこ・あなた', 'すごい たろう']);
  });
  it('自分の足跡（もらった分）でも同じ。付いていなければ空', () => {
    expect(stampWhoLines(stamps, 'u-owner')).toEqual(['ナイス はなこ・わたし', 'すごい たろう']);
    expect(stampWhoLines([], 'me')).toEqual([]);
  });
});

// 週の区切り（D7-6）。今日は 2026-11-18（水）＝今週は 11/16〜11/22、先週は 11/9〜11/15
describe('weekDividerLabel（足跡の流れの週の区切り）', () => {
  const TODAY = '2026-11-18';
  it('同じ週の中では出さない（先頭の足跡が今週のときも出さない）', () => {
    expect(weekDividerLabel(undefined, '2026-11-18', TODAY)).toBeNull();
    expect(weekDividerLabel('2026-11-18', '2026-11-16', TODAY)).toBeNull();
  });
  it('今週から先週に変わるところで「先週」。境目は月曜（日曜は先週・月曜は今週）', () => {
    expect(weekDividerLabel('2026-11-16', '2026-11-15', TODAY)).toBe('先週');
    expect(weekDividerLabel('2026-11-16', '2026-11-09', TODAY)).toBe('先週');
  });
  it('先頭の足跡が先週なら、先頭にも「先週」（今週の足跡が無いとき）', () => {
    expect(weekDividerLabel(undefined, '2026-11-12', TODAY)).toBe('先週');
  });
  it('先週より前に変わるところは、その週の月曜で「11/2の週」。同じ週の中では出さない', () => {
    expect(weekDividerLabel('2026-11-12', '2026-11-05', TODAY)).toBe('11/2の週');
    expect(weekDividerLabel('2026-11-05', '2026-11-03', TODAY)).toBeNull();
  });
});

describe('achievementChips（帯の達成チップ）', () => {
  const base = { kind: 'workout' as const };
  it('自己ベスト・節目・スタンプの順で文言にする', () => {
    expect(achievementChips({ ...base, personalBestExercises: ['ベンチプレス', 'スクワット'], milestoneDay: 7, earnedStamps: ['weight-1t'] })).toEqual([
      '自己ベスト ベンチプレス ほか1',
      '7回目',
      '総重量1t',
    ]);
  });
  it('ランの最長', () => expect(achievementChips({ kind: 'run', longestRun: true })).toEqual(['自己ベスト 最長ラン']));
  it('1回目は「初めての記録」と重ねない', () => expect(achievementChips({ ...base, milestoneDay: 1, earnedStamps: ['first-record'] })).toEqual(['初めての記録']));
  it('休み・投稿には出さない', () => {
    expect(achievementChips({ kind: 'rest', milestoneDay: 7 })).toEqual([]);
    expect(achievementChips({ kind: 'post', earnedStamps: ['first-record'] })).toEqual([]);
  });
  it('何も無ければ空', () => expect(achievementChips(base)).toEqual([]));
});
