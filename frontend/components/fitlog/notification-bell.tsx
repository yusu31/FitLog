'use client';

import { Bell } from 'lucide-react';
import Link from 'next/link';
import { useListNotifications } from '@/lib/api/generated';
import { badgeText } from '@/lib/notifications';
import { usePreferences } from '@/lib/use-preferences';

// 右上のベル（D7-3）。押すと通知の一覧（/notifications）。未読があれば数字を出す。
// 1分ごとと、画面に戻ったときに取り直す（タブの新着の印と同じ）。失敗しても数字を出さないだけで、ベルは使える。
// マークだけで分かるものは枠なし（D0 の決定 15）。数字のバッジは枠の外に重ねる
export const NOTIFICATIONS_REFRESH_MS = 60_000;

export function NotificationBell() {
  const { data } = useListNotifications({ query: { staleTime: NOTIFICATIONS_REFRESH_MS, refetchInterval: NOTIFICATIONS_REFRESH_MS, retry: false } });
  const { notify } = usePreferences();
  // 設定でオフにした種類は数えない（一覧と同じ）
  const count = data?.status === 200 ? data.data.items.filter((n) => n.unread && notify[n.kind]).length : 0;
  return (
    <Link
      href="/notifications"
      aria-label={count > 0 ? `通知（未読${count}件）` : '通知'}
      className="relative flex size-11 items-center justify-center rounded-full text-fg-muted outline-none focus-visible:ring-4 focus-visible:ring-teal/40"
    >
      <Bell aria-hidden className="size-6" />
      {count > 0 && (
        <span
          data-testid="notification-badge"
          aria-hidden
          className="absolute top-0.5 right-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-coral-strong px-1 text-note leading-none font-extrabold text-white ring-2 ring-canvas"
        >
          {badgeText(count)}
        </span>
      )}
    </Link>
  );
}
