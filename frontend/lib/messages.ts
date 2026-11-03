import { messageOf } from '@/lib/api/message';
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

// GPX の取り込み（F-14）。読めないときも責めず、事実と次にできることだけを書く
export const GPX_MESSAGES = {
  TOO_LARGE: 'ファイルが大きすぎます（5MBまで）。短いルートのファイルで ためしてね',
  INVALID_XML: 'このファイルは GPX として読めませんでした。別のファイルを選んでね',
  NO_TRACK: 'ルートの線が見つかりませんでした。走った道のあるファイルを選んでね',
  OUT_OF_RANGE: '距離が 0.1〜200km の間に入っていません。手で入力して記録できます',
} as const;

// 保存したあとの結果の一言（距離と時間を添える）
export const runSavedMessage = (distanceM: number, durationS: number): string =>
  `${formatDistance(distanceM)} を ${formatDuration(durationS)} で。${RUN_MESSAGES.tail}`;

// 記録の詳細（S-21）。読み込めない・見つからないときも責めない。スタンプ・コメント・動画・ルートは 02-4
export const DETAIL_MESSAGES = {
  kindWorkout: '筋トレ',
  kindRun: 'ラン',
  kindRest: 'おやすみ',
  restBody: '休むのも 記録のひとつ。ちゃんと数えたよ。',
  noSets: 'セットは まだありません',
  notFoundTitle: '記録が見つかりませんでした',
  notFoundBody: 'すでに消えたか、見られない記録かもしれません',
  loadFailed: '読み込めませんでした。電波の良い所で開き直してください',
  removing: '消しています',
  deleteButton: 'この記録を 消す',
  backMe: '自分にもどる',
  backFriends: '仲間にもどる',
} as const;

// 送信待ちの帯（screen-design.md「送信待ちの表示（F-30）」）。電波や通信のせいで、本人の落ち度ではない。責めない
export const SYNC_MESSAGES = {
  pending: (n: number): string => `送信待ち ${n}件`,
  savedNote: 'この端末に保存ずみ。つながったら自動で送るよ',
  retryNote: 'この端末に保存ずみ。順番に送りなおしているよ',
  authNote: '記録は残ってるよ。ログインで送るね',
  login: 'ログイン',
  sent: (n: number): string => `${n}件 送ったよ`,
  rejected: '送れなかった記録があります',
  rejectedNote: '内容が受け付けられませんでした。もう一度記録してください',
  dismiss: 'とじる',
  // 電波なしで「できた」を押した直後のシートに足す1行
  sheetNote: 'この端末に保存したよ。電波が戻ったら送るね',
} as const;

// 仲間タブの足跡・週の合計・スタンプ・コメント（S-20。screen-design.md「スタンプと定型コメント（F-10）」）。
// 順位・連続日数・数を競う言い方は入れない。付け外しは電波があるときだけ（F-30）
export const FEED_MESSAGES = {
  weekHeading: '今週のグループ',
  totalsEmpty: '今週は まだ だれも記録していないよ',
  volumeLabel: '総重量',
  distanceLabel: '走った',
  empty: '今週の足跡は まだないよ。最初の1つを どうぞ',
  loadFailed: '足跡を読み込めませんでした。電波の良い所で開き直してください',
  loadMore: 'もっと見る',
  stampFailed: 'スタンプを送れませんでした。少し待って、もう一度お試しください',
  offlineNote: '電波があるときだけ スタンプとコメントを付けられます',
  commentsOpen: (n: number): string => (n > 0 ? `コメント ${n}` : 'コメント'),
  commentInputLabel: '自由に書く（50字まで）',
  commentSend: '送る',
  commentSent: 'コメントを送ったよ',
  commentLength: 'コメントは1〜50字で入れてください',
  commentFailed: 'コメントを送れませんでした。少し待って、もう一度お試しください',
  stampsHeading: 'スタンプ',
  commentsHeading: 'コメント',
  commentsEmpty: 'コメントは まだないよ',
  commentsLoadFailed: 'コメントを読み込めませんでした。電波の良い所で開き直してください',
  stampsLoadFailed: 'スタンプを読み込めませんでした。電波の良い所で開き直してください',
  commentDelete: '消す',
  commentDeleteFailed: 'コメントを消せませんでした。少し待って、もう一度お試しください',
} as const;
