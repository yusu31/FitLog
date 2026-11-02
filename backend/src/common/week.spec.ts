import { cellStatus, weekDates, weekStartOf } from './week.js';

// 週の範囲（月曜〜日曜）と7マスの状態（docs/testing-design.md 3-3 の T-DATE-08・09。画面と API が使う共通の関数）。
// 2026-10-25 は日曜、2026-10-26 は月曜（同 7 章）。

describe('weekStartOf（その日を含む週の月曜）', () => {
  it.each<[string, string, string]>([
    ['T-DATE-08 日曜は、前の月曜から始まる週に入る', '2026-10-25', '2026-10-19'],
    ['T-DATE-08 月曜は、新しい週の始まり', '2026-10-26', '2026-10-26'],
    ['水曜は、その週の月曜', '2026-10-28', '2026-10-26'],
    ['年またぎ（2027-01-01 金曜）は前年の月曜', '2027-01-01', '2026-12-28'],
    ['月またぎ（2026-11-01 日曜）は10月の月曜', '2026-11-01', '2026-10-26'],
    ['うるう日（2028-02-29 火曜）', '2028-02-29', '2028-02-28'],
  ])('%s', (_name, date, expected) => {
    expect(weekStartOf(date)).toBe(expected);
  });
});

describe('weekDates（月曜から7日）', () => {
  it('月曜〜日曜の7日が、日付の昇順で並ぶ', () => {
    expect(weekDates('2026-10-26')).toEqual(['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01']);
  });

  it('年またぎの週も7日そろう', () => {
    expect(weekDates('2026-12-28')).toEqual(['2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03']);
  });
});

describe('cellStatus（1日分のマス: rec／rest／none）', () => {
  it.each<[string, Array<'workout' | 'run' | 'rest'>, 'rec' | 'rest' | 'none']>([
    ['T-DATE-09 記録した日（筋トレ）は rec', ['workout'], 'rec'],
    ['T-DATE-09 記録した日（ラン）は rec', ['run'], 'rec'],
    ['T-DATE-09 休んだ日は rest', ['rest'], 'rest'],
    ['T-DATE-09 何もない日は none', [], 'none'],
    ['T-DATE-09 同じ日に記録と休みがあれば rec が優先', ['rest', 'workout'], 'rec'],
    ['休みと、ランがあっても rec が優先（順序に依らない）', ['run', 'rest'], 'rec'],
  ])('%s', (_name, kinds, expected) => {
    expect(cellStatus(kinds)).toBe(expected);
  });
});
