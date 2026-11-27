import type { FeedItemKind, GroupBackground, MemberToday } from '@/lib/api/generated';

// 仲間タブ（B05）だけで使う文言。lib/messages.ts は別の束が編集するので、ここに置く
export const FRIENDS_TEXT = {
  stampSent: 'スタンプを送ったよ',
  stampCancelled: 'スタンプを取り消したよ',
  stampUndoHint: 'もう一度押すと取り消せます',
  sentCommentsLabel: '送ったコメント',
  groupSettings: 'グループの設定（メンバー・招待・出る）',
  // 自分1人のグループ（A09-5）。足跡には自分の今週の記録が、グループを作る前のものも含めて並ぶ
  aloneTitle: '仲間がいると、続きます',
} as const;

// 運動場の背景の名前（選ぶ画面と、運動場の読み上げに使う）。並びは選ぶ画面の順
export const GROUND_ORDER: readonly GroupBackground[] = ['yard', 'gym', 'park', 'city'];
export const GROUND_NAMES: Record<GroupBackground, string> = { yard: '運動場', gym: 'ジム', park: '公園', city: '街' };

// メンバーの今日のようす（運動場のポーズと、一覧の札）
export const TODAY_LABEL: Record<MemberToday, string> = { workout: '筋トレ済み', run: 'ラン済み', rest: '休み', none: 'まだ' };

// 定型コメント。軽い言葉を前に置き、「今度いっしょにやろう」のような約束に聞こえる言葉は後ろに回す
export const LIGHT_QUICK_COMMENTS: Record<FeedItemKind, readonly string[]> = {
  workout: ['ナイス！', 'おつかれさま', 'いい調子！', 'さすが！', '今度いっしょにやろう'],
  run: ['ナイス！', 'おつかれさま', 'いい調子！', 'さすが！', '今度いっしょにやろう'],
  rest: ['ゆっくり休んでね', 'おつかれさま', 'また一緒にやろう'],
  post: ['ナイス！', 'おつかれさま', 'いい調子！', 'さすが！', '今度いっしょにやろう'],
};
