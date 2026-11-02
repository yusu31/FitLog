// 画面の文言に使ってはいけない語（責めない言葉。features.md UC-12・2.5、T-DATE-13・T-GHOST-13）。
// 文言を足したら messages.test.ts がこの一覧との突き合わせで検査する。語を足すときはここだけを直す。
export const FORBIDDEN_WORDS: readonly string[] = [
  'また 0 から',
  'また0から',
  '途切れ',
  '途絶え',
  'リセット',
  '負け',
  'サボ',
  'さぼ',
  'ダメ',
  '失敗',
];
