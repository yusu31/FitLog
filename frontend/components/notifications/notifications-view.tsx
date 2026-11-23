'use client';

import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { PageTitle } from '@/components/fitlog/app-shell';
import { Avatar } from '@/components/fitlog/avatar';
import { Sprite } from '@/components/fitlog/sprite';
import { getListNotificationsQueryKey, markNotificationsSeen, useListNotifications } from '@/lib/api/generated';
import { describeNotification, formatNotificationTime, notificationHref } from '@/lib/notifications';
import { usePreferences } from '@/lib/use-preferences';

// S-37 お知らせ（D7-3）。スタンプ／コメントをもらった・仲間が記録した・仲間が加わった を新しい順に。
// 開いて一覧が読めたら「見た」を送る。ベルの数字は0にするが、この画面では「どれが新しかったか」の点を残す
export function NotificationsView() {
  const { data, isPending, isError } = useListNotifications();
  const ready = data?.status === 200;
  useMarkSeen(ready);
  const { notify } = usePreferences();
  // 設定でオフにした種類は出さない
  const items = data?.status === 200 ? data.data.items.filter((n) => notify[n.kind]) : [];

  return (
    <div className="relative">
      <PageTitle>おしらせ</PageTitle>
      <div className="space-y-2 px-4 pt-3">
        {isPending ? (
          <div aria-busy="true" aria-label="読み込み中" className="h-40 animate-pulse rounded-fl bg-canvas" />
        ) : isError || !data || data.status !== 200 ? (
          <p role="alert" className="rounded-fl bg-coral-light px-4 py-3 text-sm font-bold text-fg">
            お知らせを読み込めませんでした。電波の良い所でもう一度ためしてください
          </p>
        ) : items.length === 0 ? (
          <section className="flex flex-col items-center gap-1 pt-6">
            <Sprite pose="idle" size={96} />
            <p className="text-base font-extrabold">まだ おしらせは ありません</p>
          </section>
        ) : (
          <ul aria-label="お知らせの一覧" className="space-y-2">
            {items.map((n) => (
              <li key={n.id}>
                <Link
                  href={notificationHref(n)}
                  className="fl-slab flex min-h-14 items-center gap-3 py-2 pr-3 pl-2.5 outline-none focus-visible:ring-4 focus-visible:ring-teal/40"
                >
                  <Avatar shirtColor={n.actor.avatar.shirtColor} size={44} />
                  <span className="min-w-0 flex-1 leading-snug">
                    <span className="block text-[15px] font-extrabold">{describeNotification(n)}</span>
                    <span className="block text-note font-bold text-fg-subtle">{formatNotificationTime(String(n.at))}</span>
                  </span>
                  {n.unread && (
                    <span data-testid="unread-dot" className="size-2.5 shrink-0 rounded-full bg-coral-strong">
                      <span className="sr-only">未読</span>
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// 一覧が読めたら1回だけ「見た」を送り、ベルの数字を0にする（一覧の中身は取り直さない＝未読の点は残る）
function useMarkSeen(ready: boolean) {
  const queryClient = useQueryClient();
  const sent = useRef(false);
  useEffect(() => {
    if (!ready || sent.current) return;
    sent.current = true;
    markNotificationsSeen()
      .then(() =>
        queryClient.setQueryData(getListNotificationsQueryKey(), (old: { status: number; data: { unreadCount: number; items: unknown[] }; headers: Headers } | undefined) =>
          old ? { ...old, data: { ...old.data, unreadCount: 0 } } : old,
        ),
      )
      .catch(() => undefined);
  }, [ready, queryClient]);
}
