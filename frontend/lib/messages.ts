// 画面の文言の定数（features.md 2.5・UC-11・UC-12）。責めない言葉にする。
// 使ってはいけない語は forbidden-words.ts に一覧があり、messages.test.ts で検査する。

// ゴーストの結果の言い方。上回りは数字が入るので関数にする
export const ghostUpMessage = (diff: number): string => `前回超え +${diff}`;

export const GHOST_MESSAGES = {
  same: '前回と おなじ',
  down: 'ちゃんと 記録したよ。むりしない日もOK',
} as const;

// ホームの一言（おかえり・前日の記録の有無に応じた出し分け）。あいた日数は責めずに一言添える程度にとどめる
export const HOME_MESSAGES = {
  welcomeBack: 'おかえり。また 一緒に はじめよう',
  recordedYesterday: '昨日も記録したね。今日も できる分だけ',
  restYesterday: '昨日は お休み。今日は 気が向いたら',
  noRecordYesterday: '今日の 1セットから はじめよう',
} as const;
