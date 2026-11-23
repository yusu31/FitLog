// 「＜」の戻り先を、来た所に合わせる（02-9 遷移の地図 N2・N3・N5）。
// 入口のリンクに ?back=friends のように付け、行き先の画面が読む。静的書き出しなので状態はクエリで運ぶ。
// 任意の URL を受けると外のサイトへ飛ばされる（オープンリダイレクト）ので、決めた名前だけを受け、知らない値は既定の戻り先にする
export const BACK_TARGETS = {
  friends: { href: '/friends', label: '仲間へ戻る' },
  notifications: { href: '/notifications', label: '通知へ戻る' },
  settings: { href: '/settings', label: '設定へ戻る' },
} as const;

export type BackKey = keyof typeof BACK_TARGETS;
export type Back = { href: string; label: string };

export function backTarget(value: string | null | undefined, allowed: readonly BackKey[], fallback: Back): Back {
  const key = allowed.find((k) => k === value);
  return key ? BACK_TARGETS[key] : fallback;
}

export const withBack = (href: string, key: BackKey): string => `${href}${href.includes('?') ? '&' : '?'}back=${key}`;
