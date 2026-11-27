// 通知（D7-3）の文言とリンク先。画面の部品から切り離した純粋な関数。順位・数を競う言い方は入れない。
import type { NotificationItem } from '@/lib/api/generated';
import { STAMP_LABELS } from '@/lib/feed';

const RECORD_KIND_LABEL = { workout: '筋トレ', run: 'ラン', rest: 'おやすみ', post: '投稿' } as const;

// 1件の文。した人の名前から始める（「はなこさんが 〜」）
export function describeNotification(n: Pick<NotificationItem, 'kind' | 'actor' | 'recordKind' | 'stampKey'>): string {
  const who = `${n.actor.name}さん`;
  switch (n.kind) {
    case 'stamp':
      return `${who}が「${n.stampKey ? STAMP_LABELS[n.stampKey] : 'スタンプ'}」を送りました`;
    case 'comment':
      return `${who}がコメントしました`;
    case 'friend_record':
      return `${who}が${n.recordKind ? RECORD_KIND_LABEL[n.recordKind] : '運動'}を記録しました`;
    case 'friend_joined':
      return `${who}が仲間に加わりました`;
  }
}

// 押したときの行き先。記録に関係するものは記録の詳細へ。自分の記録（スタンプ・コメント）は from=me で開く。
// 仲間の記録は、した人（actor）が書いた人なので by= を付ける（フィードから開いたときと同じく「まねする」を出す。N4）。
// どちらも「＜」で通知へ戻す（back=notifications。N3）
export function notificationHref(n: Pick<NotificationItem, 'kind' | 'recordId' | 'actor'>): string {
  if (n.kind === 'friend_joined' || !n.recordId) return '/friends';
  const id = encodeURIComponent(n.recordId);
  return n.kind === 'friend_record'
    ? `/record-detail?id=${id}&by=${encodeURIComponent(n.actor.id)}&back=notifications`
    : `/record-detail?id=${id}&from=me&back=notifications`;
}

// ベルの数字。10以上は「9+」（タブの新着の印と同じ）
export const badgeText = (count: number): string => (count > 9 ? '9+' : String(count));

// "2026-11-21T03:05:00.000Z" → 日本時間の "11/21 12:05"（端末のタイムゾーンを使わない）
export function formatNotificationTime(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 9 * 3600 * 1000);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()} ${d.getUTCHours()}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}
