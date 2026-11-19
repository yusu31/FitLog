import type { FeedItemKind } from '@/lib/api/generated';

// 仲間タブ（B05）だけで使う文言。lib/messages.ts は別の束が編集するので、ここに置く
export const FRIENDS_TEXT = {
  stampSent: 'スタンプを送ったよ',
  stampCancelled: 'スタンプを取り消したよ',
  stampUndoHint: 'もう一度押すと取り消せます',
  sentCommentsLabel: '送ったコメント',
  todayEmpty: '今日の足跡は まだないよ',
  showOlder: (n: number): string => `前の日の足跡を見る（${n}件）`,
  groupSettings: 'グループの設定（メンバー・招待・出る）',
  // 自分1人のグループ（A09-5）。足跡には自分の今週の記録が、グループを作る前のものも含めて並ぶ
  aloneFeedNote: '今はあなただけ。今週の記録は、グループを作る前のものもここに出ます。仲間が入ると、仲間の足跡も並びます',
} as const;

// 定型コメント。軽い言葉を前に置き、「今度いっしょにやろう」のような約束に聞こえる言葉は後ろに回す
export const LIGHT_QUICK_COMMENTS: Record<FeedItemKind, readonly string[]> = {
  workout: ['ナイス！', 'おつかれさま', 'いい調子！', 'さすが！', '今度いっしょにやろう'],
  run: ['ナイス！', 'おつかれさま', 'いい調子！', 'さすが！', '今度いっしょにやろう'],
  rest: ['ゆっくり休んでね', 'おつかれさま', 'また一緒にやろう'],
};
