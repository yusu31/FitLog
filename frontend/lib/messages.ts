import { messageOf } from '@/lib/api/message';

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

// グループまわり（S-20・S-32。features.md 2.1〜2.2）。本人の落ち度ではないこと（満員・期限切れ・すでに所属）は、
// 事実と次にできることだけを短く書く。「失敗」は禁止語（forbidden-words.ts）なので使わない
export const GROUP_MESSAGES = {
  nameLength: 'グループ名は1〜20字で入れてください',
  network: '通信できませんでした。電波の良い所でもう一度お試しください',
  loadFailed: '読み込めませんでした。電波の良い所で開き直してください',
  createFailed: 'グループを作れませんでした。少し待って、もう一度お試しください',
  invitationFailed: '招待リンクを作れませんでした。少し待って、もう一度お試しください',
  revokeFailed: '取り消せませんでした。少し待って、もう一度お試しください',
  leaveFailed: 'グループを出られませんでした。少し待って、もう一度お試しください',
  copyFailed: 'コピーできませんでした。リンクを長押しして選んでください',
} as const;

// API の応答の code（design.md 5章）→ 画面の文言
export const GROUP_ERROR_BY_CODE: Record<string, string> = {
  GROUP_FULL: 'このグループは満員です（5人まで）。だれかが出ると、また入れます',
  ALREADY_IN_GROUP: 'すでにグループに入っています。1人が入れるグループは1つです',
  INVITATION_EXPIRED: '招待リンクの期限が切れています。新しいリンクを作ってください',
  INVITATION_NOT_FOUND: '招待が見つかりません。すでに取り消されているかもしれません',
  GROUP_NOT_FOUND: 'グループに入っていません。グループを作るか、招待リンクで参加してください',
  VALIDATION_ERROR: GROUP_MESSAGES.nameLength,
};

// code が分かればその言い方、知らない code なら API の message、それも無ければ呼ぶ側の fallback
// 5xx（サーバーの不具合）は message に内部の事情が混ざりうるので、いつも fallback にする
export function groupErrorMessage(body: unknown, fallback: string, status?: number): string {
  if (status !== undefined && status >= 500) return fallback;
  const code = (body as { code?: unknown } | null)?.code;
  if (typeof code === 'string' && Object.hasOwn(GROUP_ERROR_BY_CODE, code)) return GROUP_ERROR_BY_CODE[code];
  return messageOf(body, fallback);
}
