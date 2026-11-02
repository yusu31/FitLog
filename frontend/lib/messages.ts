import { formatDistance, formatDuration } from './format';

// 画面の文言の定数（features.md 2.5・UC-11・UC-12）。責めない言葉にする。
// 使ってはいけない語は forbidden-words.ts に一覧があり、messages.test.ts で検査する。

// ゴーストの結果の言い方。上回りは数字が入るので関数にする
export const ghostUpMessage = (diff: number): string => `前回超え +${diff}`;

export const GHOST_MESSAGES = {
  same: '前回と おなじ',
  down: 'ちゃんと 記録したよ。むりしない日もOK',
} as const;

// 記録画面（S-12）の文言。結果の言い方は GHOST_MESSAGES を使う
export const RECORD_MESSAGES = {
  // 前回が無い（比べる相手がいない）セットの結果
  recorded: '記録したよ',
  best: 'ベスト',
  trial: 'お試し',
  noPrevious: '前回の記録は まだないよ',
} as const;

// ホームの一言（おかえり・前日の記録の有無に応じた出し分け）。あいた日数は責めずに一言添える程度にとどめる
export const HOME_MESSAGES = {
  welcomeBack: 'おかえり。また 一緒に はじめよう',
  recordedYesterday: '昨日も記録したね。今日も できる分だけ',
  restYesterday: '昨日は お休み。今日は 気が向いたら',
  noRecordYesterday: '今日の 1セットから はじめよう',
} as const;

// おやすみ画面（S-14）。休むのも記録のひとつ。責めない
export const REST_MESSAGES = {
  title: 'おやすみ',
  body: '休むのも 記録のひとつ。今週の「休み」に ちゃんと数えたよ。',
  back: 'もどる',
  sendError: '休みを 送れませんでした。電波の良い所でもう一度ためしてください',
} as const;

// 自分の記録の一覧（S-30）の「削除」
export const ME_MESSAGES = {
  deleteTitle: 'この記録を 消しますか？',
  deleteNote: '筋トレの記録は、中のセットも一緒に消えます。',
  deleteError: '消せませんでした。電波の良い所でもう一度ためしてください',
  offlineNote: '電波があるときだけ 消せます',
} as const;

// ラン記録画面（S-13）
export const RUN_MESSAGES = {
  saved: 'ランを 記録したよ',
  tail: 'おつかれさま。今日の1歩が ちゃんと残ったよ',
  distanceRange: '距離は 0.1〜200km の間で入れてね',
  durationRange: '時間は 1分〜24時間の間で入れてね（秒は 0〜59）',
  sendError: '送れませんでした。電波の良い所でもう一度ためしてください',
} as const;

// 保存したあとの結果の一言（距離と時間を添える）
export const runSavedMessage = (distanceM: number, durationS: number): string =>
  `${formatDistance(distanceM)} を ${formatDuration(durationS)} で。${RUN_MESSAGES.tail}`;
