'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Dumbbell, User, Users } from 'lucide-react';
import { cn } from 'cn';
import { useGetFeedUnread } from '@/lib/api/generated';

// 下のタブは3つ（docs/screen-design.md 1章）。選択中は色だけでなく aria-current と背景で示す
const TABS = [
  { href: '/today', label: '今日', Icon: Dumbbell },
  { href: '/friends', label: '仲間', Icon: Users },
  { href: '/me', label: '自分', Icon: User },
] as const;

// 静的書き出しは trailingSlash: true なので、/friends と /friends/ の両方を同じタブとみなす
const isActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

// 新着の印（F4）。ログインしているときだけ GET /feed/unread を見て、「仲間」に点を出す。
// 仲間タブを開いている間は出さない（見ている最中。足跡が読めたら「見た」を送り、点の元の値も false にする）。
// 1分ごとに取り直す（画面に戻ったときも取り直す。TanStack Query の既定）。失敗しても点を出さないだけで、タブは使える
const UNREAD_REFRESH_MS = 60_000;

export function TabBar({ signedIn = false }: { signedIn?: boolean }) {
  const pathname = usePathname() ?? '';
  const unread = useGetFeedUnread({ query: { enabled: signedIn, staleTime: UNREAD_REFRESH_MS, refetchInterval: UNREAD_REFRESH_MS, retry: false } });
  const hasNew = unread.data?.status === 200 && unread.data.data.hasNew;
  // 件数（A04-9）。API が newCount を返すようになったらその数字を出す。返さない間は「新」の字（無印の赤い点にしない）
  const body = (unread.data?.status === 200 ? unread.data.data : undefined) as { newCount?: unknown } | undefined;
  const newCount = typeof body?.newCount === 'number' && body.newCount > 0 ? body.newCount : undefined;
  return (
    <nav aria-label="メイン" className="fixed bottom-0 left-1/2 z-10 w-full max-w-[430px] -translate-x-1/2 border-t-2 border-line bg-white">
      <ul className="flex justify-around px-3 pt-1.5 pb-[max(10px,env(safe-area-inset-bottom))]">
        {TABS.map(({ href, label, Icon }) => {
          const active = isActive(pathname, href);
          const dot = href === '/friends' && hasNew && !active;
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex h-13 w-21 flex-col items-center justify-center gap-0.5 rounded-fl text-[11px] font-bold outline-none',
                  'focus-visible:ring-4 focus-visible:ring-teal/40',
                  // 選択中の文字は濃いティール（ティール10%の背景の上で 4.5 以上）
                  active ? 'bg-teal/10 text-teal-deep' : 'text-sub',
                )}
              >
                <span className="relative">
                  <Icon aria-hidden className="size-6" strokeWidth={active ? 2.6 : 2.2} />
                  {dot && (
                    <span
                      data-testid="friends-new-badge"
                      aria-hidden
                      className="absolute -top-1.5 -right-3 flex h-4 min-w-4 items-center justify-center rounded-full bg-coral-strong px-1 text-[10px] leading-none font-extrabold text-white ring-2 ring-white"
                    >
                      {newCount === undefined ? '新' : newCount > 9 ? '9+' : newCount}
                    </span>
                  )}
                </span>
                {label}
                {dot && <span className="sr-only">{newCount === undefined ? '（新着あり）' : `（新着${newCount}件）`}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
