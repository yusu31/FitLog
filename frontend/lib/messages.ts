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
  trial: '目安',
  noPrevious: '前回の記録は まだないよ',
  // A02-5: 前回から3日以上あいたとき、目標を前回と同じ値にした理由（責めない）
  restReturn: 'しばらく あいたので、前回と おなじ値から。ゆっくり いこう',
  // A03-6: 数字の欄は打って入力できる
  bodyweight: '自重（重さは入れなくてOK）',
  addWeight: 'おもりをつける',
  typeHint: '数字を タップすると、直接 入力できます',
  // A03-4: 「できた」が押せないとき・進み具合
  waitPrevious: '前回の記録を 読み込んでいます。少し待ってね',
  // A03-2: 「できた」のあとの選択肢
  stop: '今日はここまで',
  restStart: '休憩する',
  closeMore: 'とじる',
  // D3 L12: 入力欄の横に小さく出す今日の目標。例「目標 62.5kg × 8回」
  target: (weight: string, reps: number) => `目標 ${weight} × ${reps}回`,
  // A06-1・A06-2: 動画の入口（専門語を使わない）
  video: '2秒動画を撮る',
  videoHint: '最後の1回を 2秒だけ 動画に',
  // A03-3: バーの読み方
  barNow: '今回',
  barPrev: '前回',
  // A12-5: いまのセット番号
  setNow: (n: number) => `いま ${n}セット目`,
} as const;

// 記録画面を左上の ✕ で閉じるときの確認（A03-5）
export const RECORD_CLOSE_MESSAGES = {
  title: 'ここで 閉じますか？',
  body: 'いままでの記録は 残ります。あとで続きから できます',
  keep: 'つづける',
  close: 'とじる',
} as const;

// ホームの一言（おかえり・前日の記録の有無に応じた出し分け）。あいた日数は責めずに一言添える程度にとどめる
export const HOME_MESSAGES = {
  welcomeBack: 'おかえり。また 一緒に はじめよう',
  recordedYesterday: '昨日も記録したね。今日も できる分だけ',
  restYesterday: '昨日は お休み。今日は 気が向いたら',
  noRecordYesterday: '今日の 1セットから はじめよう',
  // ホームの「今日の1行」（02-9 ⑫）
  todayRecorded: '今日は記録できたよ。おつかれさま',
  todayRest: '今日はおやすみ。ゆっくり休もう',
  todayNone: '今日の 1セットから はじめよう',
  timeline: '仲間のタイムライン',
  // 今日の記録の帯（02-9 PR 7a）。分母は出さない
  todayBand: '今日の記録',
  todayBandComplete: '今日は全員そろった！',
  todayBandMePending: 'まだ',
  noGroup: '仲間とつながると、ここに足跡が流れます',
} as const;

// 仲間がいない人に見せる見本（02-9 ⑭）。本物の仲間ではないことを、見出しと札で伝える。順位・連続日数・目標未達の言葉は使わない
export const DEMO_FRIENDS_MESSAGES = {
  label: '仲間の見本',
  title: '仲間がいると、こう見えます（見本）',
  lead: 'この4人は見本です。招待すると、本物の仲間の足跡がここに流れます',
  toggleLabel: 'デモ仲間',
  toggleOn: '有り',
  toggleOff: '無し',
  tag: '見本',
  listLabel: '見本の仲間の足跡',
} as const;

// グループまわり（S-20・S-32。features.md 2.1〜2.2）。本人の落ち度ではないこと（満員・期限切れ・すでに所属）は、
// 事実と次にできることだけを短く書く。「失敗」は禁止語（forbidden-words.ts）なので使わない
export const GROUP_MESSAGES = {
  nameLength: 'グループ名は1〜20字で入れてください',
  network: '通信できませんでした。電波の良い所でもう一度お試しください',
  loadFailed: '読み込めませんでした。電波の良い所で開き直してください',
  createFailed: 'グループを作れませんでした。少し待って、もう一度お試しください',
  descriptionLength: 'ミッションの説明は100字までにしてください',
  updateFailed: 'ミッションを保存できませんでした。少し待って、もう一度お試しください',
  updateSaved: '保存しました',
  invitationFailed: '招待リンクを作れませんでした。少し待って、もう一度お試しください',
  revokeFailed: '取り消せませんでした。少し待って、もう一度お試しください',
  leaveFailed: 'グループを出られませんでした。少し待って、もう一度お試しください',
  copyFailed: 'コピーできませんでした。リンクを長押しして選んでください',
  shareFailed: '共有できませんでした。「コピー」して送ってください',
  pasteInvalid: '招待リンクが読み取れませんでした。届いたリンクをそのまま貼ってください',
} as const;

// アカウントの設定（表示名・パスワードの変更。F2-a）。本人の落ち度にしない
export const ACCOUNT_MESSAGES = {
  nameEmpty: '表示名を入れてください（30字まで）',
  nameSaved: '保存しました',
  nameFailed: '保存できませんでした。少し待って、もう一度お試しください',
  passwordChanged: '変更しました。ほかの端末では、ログインし直しになります',
  passwordWrong: '今のパスワードが違います。入れ直してください',
  passwordShort: '新しいパスワードは8文字以上にしてください',
  passwordFailed: '変更できませんでした。入力を確かめて、もう一度お試しください',
  network: '通信できませんでした。電波の良い所でもう一度お試しください',
} as const;

// 記録の書き出し（C-01。設定 S-31）。本人の落ち度にしない
export const EXPORT_MESSAGES = {
  button: '記録を書き出す（CSV）',
  busy: '書き出しています…',
  hint: '表計算ソフトで開けます（自分の記録だけ）',
  failed: '書き出せませんでした。少し待って、もう一度お試しください',
  network: '通信できませんでした。電波の良い所でもう一度お試しください',
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
// あとから記録（F-21）。「遅れた」を責めない言い方にする（T-DATE-13）
export const LATE_MESSAGES = {
  today: '今日',
  yesterday: 'きのう',
  toYesterday: 'きのうの分を記録する',
  toToday: '今日にもどる',
  banner: 'きのうの分を 記録しています',
  bannerOn: (label: string): string => `${label}の分を 記録しています`,
  pastRunHint: '過ぎた日のランは、距離と時間を入れるか、GPX で記録します（GPS は今のランだけ）',
  gpxOtherDay: (gpxDay: string, picked: string): string => `この GPX は ${gpxDay} のものですが、選んだ日（${picked}）で保存します`,
  tag: 'あとから記録',
  noVideo: '動画は、その日のうちの記録にだけ付けられます',
} as const;

// 今日画面の上の「仲間」（A01-8・A02-1）。順位や数を競う言い方はしない
export const TODAY_FRIENDS_MESSAGES = {
  label: '仲間の今日',
  recorded: (names: string): string => `${names} が記録`,
  rested: (names: string): string => `${names} はおやすみ`,
  none: 'まだ 足跡は ないよ',
  invite: '仲間を招待する',
  noGroupTitle: '仲間といっしょに 続けよう',
  noGroupSteps: 'グループを作って、招待リンクを送ると、仲間の足跡がここに出ます',
  aloneTitle: 'まだ ひとりだけ。仲間を招待しよう',
  aloneSteps: '招待リンクを送ると、仲間の足跡がここに出ます',
  close: '招待の案内を閉じる',
} as const;

export const REST_MESSAGES = {
  title: 'おやすみ',
  body: '休むのも 記録のひとつ。今週の「休み」に ちゃんと数えたよ。',
  back: 'もどる',
  changeMind: 'やっぱり記録する',
  sendError: '休みを 送れませんでした。電波の良い所でもう一度ためしてください',
} as const;

// 筋トレの「記録中」と「今日はここまで」（N1。S-10 今日）。開始は自動（最初の「できた」）で、終わりはこのボタン（または3時間）。
// 終わらせないことを責めない。終了は電波があるときだけ（サーバーに時刻を残すため）
export const WORKOUT_END_MESSAGES = {
  active: '記録中',
  tag: 'いま',
  count: (exercises: number, sets: number) => `${exercises}種目 ${sets}セット`,
  keepGoing: '続ける',
  end: '今日はここまで',
  offlineNote: '電波があるときだけ 終えられます',
  sendError: '終了を 送れませんでした。電波の良い所でもう一度ためしてください',
  summaryTitle: '今日のまとめ',
  thanks: 'おつかれさま。今日の分は ここまで',
  best: (n: number, names: readonly string[] = []) => `自己ベスト ${n}回${names.length > 0 ? `（${names.join('・')}）` : ''}`,
  shareWithFriends: '仲間に見せる',
  detailFailed: 'セットの一覧を読み込めませんでした。総重量もここに出ます',
  reload: 'もう一度読み込む',
  total: (kg: string, unit = 'kg') => `総重量 ${kg}${unit}`,
  close: 'とじる',
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
  noTime: 'このファイルには 時刻がありませんでした。時間は 手で入れてね',
  offline: '電波のない間は GPX を選べません。電波の良い所で ためしてね',
} as const;

// GPS で記録する（Web 版）。使えない理由は、責めずに事実と次にできることだけを書く
export const GPS_MESSAGES = {
  start: 'GPS で記録する',
  searching: 'GPS をさがしています。空の見える所で少し待ってね',
  // START 直後に1回だけ出す案内（D4）。端末ごとに2種類（アプリは案内なし）。「？」でいつでも読み返せる
  noticeTitle: '走る前に ひとつだけ',
  noticeAndroidWeb: '画面を消さないでね。画面が消えると、記録が止まります。ポケットに入れて走るなら Android アプリで',
  noticeIosWeb: '画面を消さないでね。画面が消えると、記録が止まります',
  noticeOk: 'わかった',
  // START を押す前の画面に出す1行（D4-2。端末ごと）
  beforeStartIosWeb: 'iPhone のブラウザでは、走っている間は画面を点けたままにしてください',
  beforeStartAndroidWeb: 'Android のブラウザでは、走っている間は画面を点けたままに。ポケットに入れるならアプリで',
  beforeStartApp: 'アプリなので、画面を消しても記録が続きます',
  noticeHelp: '画面を消すと？',
  noWakeLock: 'この端末は 画面を点けたままにできません。画面を消さずに走ってね（消えると記録が止まります）',
  paused: '一時停止中',
  unsupported: 'この端末では 位置情報が使えません。距離と時間を手で入れて記録できます',
  denied: '位置情報の使用が 許可されていません。ブラウザの設定で許可すると使えます。手で入れて記録もできます',
  unavailable: '位置が取れませんでした。空の見える所で もう一度ためしてね',
  TOO_SHORT: 'まだ短くて 記録にできません（0.1km・1分から）。続けるか、やめてね',
  OUT_OF_RANGE: '距離か時間が 範囲（200km・24時間）を超えています。手で入れて記録できます',
  filled: 'GPS の記録を入れました。内容を見て 保存してね',
} as const;

// 保存したあとの結果の一言（距離と時間を添える）
export const runSavedMessage = (distanceM: number, durationS: number): string =>
  `${formatDistance(distanceM)} を ${formatDuration(durationS)} で。${RUN_MESSAGES.tail}`;

// 記録の詳細（S-21）。読み込めない・見つからないときも責めない。スタンプ・コメント・動画・ルートは 02-4
export const DETAIL_MESSAGES = {
  kindWorkout: '筋トレ',
  kindRun: 'ラン',
  kindRest: 'おやすみ',
  kindPost: '投稿',
  restBody: '休むのも 記録のひとつ。ちゃんと数えたよ。',
  mapLabel: 'ランのルートの地図',
  mapLabelWithGhost: 'ランのルートの地図。点線は前回のルート',
  mapUnavailable: '地図は この端末では出せませんでした。距離とペースは上に出ています',
  sketchLabel: 'ルートの形（地図なしの線画）',
  noSets: 'セットは まだありません',
  videoLabel: '2秒ラストレップの動画',
  videoExpired: '仲間に見える期間（その週の終わりまで）が 過ぎました',
  videoUnavailable: '動画は 再生できませんでした',
  videoLocked: 'あなたも 2秒 撮ると 見られます',
  notFoundTitle: '記録が見つかりませんでした',
  notFoundBody: 'すでに消えたか、見られない記録かもしれません',
  loadFailed: '読み込めませんでした。電波の良い所で開き直してください',
  removing: '消しています',
  deleteButton: 'この記録を 消す',
  deleteRegion: '記録の削除',
  ownerMine: 'あなたの記録',
  ownerFriend: (name: string | null): string => (name ? `${name}さんの記録` : '仲間の記録'),
  copyExplain: 'この内容で今日を始めます。記録はまだ作られず、「できた」を押したときに残ります',
  backMe: '自分にもどる',
  backFriends: '仲間にもどる',
} as const;

// 送信待ちの帯（screen-design.md「送信待ちの表示（F-30）」）。電波や通信のせいで、本人の落ち度ではない。責めない
export const SYNC_MESSAGES = {
  // 電波がないあいだ、画面の上に出しっぱなしにする帯（A11-2）
  offline: '電波なし',
  offlineNote: '記録はこの端末に保存するよ。つながったら自動で送るね',
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
  // 新着の札（F4）。最後に仲間タブを見たあとに来た足跡・反応が付いた自分の記録
  newTag: '新着',
  weekHeading: '今週のグループ',
  // 足跡の流れで、週が変わるところに入れる小さな区切り（D7-6）
  lastWeek: '先週',
  totalsEmpty: '今週は まだ だれも記録していないよ',
  volumeLabel: '総重量',
  distanceLabel: '走った',
  empty: '足跡は まだないよ。最初の1つを どうぞ',
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
  stampsNoneYet: 'まだスタンプはもらっていないよ',
  commentsHeading: 'コメント',
  commentsEmpty: 'コメントは まだないよ',
  commentsLoadFailed: 'コメントを読み込めませんでした。電波の良い所で開き直してください',
  stampsLoadFailed: 'スタンプを読み込めませんでした。電波の良い所で開き直してください',
  commentDelete: '消す',
  commentDeleteFailed: 'コメントを消せませんでした。少し待って、もう一度お試しください',
} as const;

// 仲間のゴースト（F-16）とメニューのコピー（F-24）
export const FRIEND_MESSAGES = {
  heading: '仲間と くらべる',
  none: 'まだ記録なし',
  rowLabel: '仲間',
  open: 'くわしく見る',
  copyButton: 'コピーして始める',
  copying: 'じゅんびしています',
  copyFailed: 'コピーできませんでした。電波の良い所でもう一度ためしてください',
  copyOffline: '電波があるときにコピーできます',
  planFrom: (name: string | null) => (name ? `${name}さんの メニューから` : '仲間の メニューから'),
  copiedTag: (name: string | null) => (name ? `${name}さんから` : '仲間から'),
} as const;

// いつものメニュー（F3）。よくやるメニューを保存して、今日の画面から始める
export const ROUTINE_MESSAGES = {
  saveButton: 'いつものメニューに保存',
  saveHint: 'この記録を保存すると、今日の画面から ワンタップで始められます。',
  nameLabel: 'いつものメニューの名前',
  nameHint: (max: number) => `${max}字まで。同じ名前は重ねて保存できません。`,
  namePlaceholder: '例: 脚の日',
  submit: '保存する',
  saving: '保存しています',
  cancel: 'やめる',
  saved: (name: string) => `「${name}」を保存しました。今日の画面から始められます`,
  saveFailed: '保存できませんでした。電波の良い所でもう一度ためしてください',
  saveOffline: '電波があるときに保存できます',
  heading: 'ほかの始めかた（いつものメニュー）',
  start: (name: string) => `${name}を始める`,
  deleteLabel: (name: string) => `${name}を消す`,
  deleteTitle: 'いつものメニューを消しますか？',
  deleteBody: (name: string) => `「${name}」を消します。これまでの記録は消えません。`,
  deleteFailed: '消せませんでした。電波の良い所でもう一度ためしてください',
  planFrom: (name: string) => `いつものメニュー「${name}」から`,
  ghostLabel: 'いつものメニューの 予定',
} as const;

// 退会（F2-b）。元に戻せないので、消えるものを先に見せる。落ち度を責めない
export const DELETE_ACCOUNT_MESSAGES = {
  start: '退会の手続きへ',
  heading: '退会',
  warning: '退会すると、あなたの記録・動画・仲間の記録に付けたスタンプとコメントが、すべて消えます。元に戻せません。仲間の記録やグループは残ります。',
  passwordLabel: 'パスワード（確認のため）',
  confirm: '完全に退会する',
  cancel: 'やめる',
  passwordWrong: 'パスワードが違います。入れ直してください',
  failed: '退会できませんでした。少し待って、もう一度お試しください',
  network: '通信できませんでした。電波の良い所でもう一度お試しください',
} as const;

// 記録のメモ・きつさ（F5）。持ち主だけが見る。落ち度を責めない
// ひとこと（records.caption。PR 4）。仲間にも見える
export const CAPTION_MESSAGES = {
  heading: 'ひとこと',
  placeholder: '仲間に見える一言（50字まで・なくてもOK）',
  everyone: '仲間にも見えます',
  save: '保存する',
  saved: '保存しました',
  saveFailed: '保存できませんでした。電波の良い所でもう一度ためしてください',
  offline: '電波があるときに保存できます',
} as const;

// 動画だけ消す（PR 4）
export const VIDEO_DELETE_MESSAGES = {
  button: '動画だけ 消す',
  title: 'この動画を 消しますか？',
  noteOther: '動画だけ消えます。記録は残ります。',
  notePost: '投稿は動画が無いと中身が無くなるので、投稿ごと消えます。',
  confirm: '消す',
  pending: '消しています',
  error: '消せませんでした。電波の良い所でもう一度ためしてください',
} as const;

export const MEMO_MESSAGES = {
  heading: 'メモときつさ',
  rpeLabel: 'きつさ（1 らく 〜 10 限界）',
  noteLabel: 'メモ',
  notePlaceholder: '今日の調子、フォームの気づきなど',
  save: '保存する',
  saved: '保存しました',
  saveFailed: '保存できませんでした。電波の良い所でもう一度ためしてください',
  offline: '電波があるときに保存できます',
  onlyMe: '自分だけに見えます（仲間には見えません）',
} as const;
