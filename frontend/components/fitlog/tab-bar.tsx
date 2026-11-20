'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Fragment, useState } from 'react';
import { BarChart3, Dumbbell, Plus, User, Users } from 'lucide-react';
import { cn } from 'cn';
import { useGetFeedUnread } from '@/lib/api/generated';
import { StartSheet } from './start-sheet';

// 下のタブは4つ＋中央の＋（docs/screen-design.md 1章）。選択中は色だけでなく aria-current と背景で示す。
// まとめは今の /me/stats を指す（中身の作り直しは D5）。自分（/me）は /me/stats の下では選択中にしない
const TABS = [
  { href: '/today', label: '今日', Icon: Dumbbell },
  { href: '/friends', label: '仲間', Icon: Users },
  { href: '/me/stats', label: 'まとめ', Icon: BarChart3 },
  { href: '/me', label: '自分', Icon: User },
] as const;

// 静的書き出しは trailingSlash: true なので、/friends と /friends/ の両方を同じタブとみなす
const isActive = (pathname: string, href: string) => {
  if (href === '/me' && (pathname === '/me/stats' || pathname.startsWith('/me/stats/'))) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
};

// 新着の印（F4）。ログインしているときだけ GET /feed/unread を見て、「仲間」に点を出す。
// 仲間タブを開いている間は出さない（見ている最中。足跡が読めたら「見た」を送り、点の元の値も false にする）。
// 1分ごとに取り直す（画面に戻ったときも取り直す。TanStack Query の既定）。失敗しても点を出さないだけで、タブは使える
const UNREAD_REFRESH_MS = 60_000;

export function TabBar({ signedIn = false }: { signedIn?: boolean }) {
  const pathname = usePathname() ?? '';
  const [starting, setStarting] = useState(false);
  const unread = useGetFeedUnread({ query: { enabled: signedIn, staleTime: UNREAD_REFRESH_MS, refetchInterval: UNREAD_REFRESH_MS, retry: false } });
  const hasNew = unread.data?.status === 200 && unread.data.data.hasNew;
  // 件数（A04-9）。API が newCount を返すようになったらその数字を出す。返さない間は「新」の字（無印の赤い点にしない）
  const body = (unread.data?.status === 200 ? unread.data.data : undefined) as { newCount?: unknown } | undefined;
  const newCount = typeof body?.newCount === 'number' && body.newCount > 0 ? body.newCount : undefined;
  return (
    <>
    <nav aria-label="メイン" className="fixed bottom-0 left-1/2 z-10 w-full max-w-[430px] -translate-x-1/2 border-t-2 border-line bg-surface lg:sticky lg:top-0 lg:bottom-auto lg:left-auto lg:order-first lg:h-dvh lg:w-56 lg:shrink-0 lg:translate-x-0 lg:self-start lg:border-t-0 lg:bg-transparent">
      <ul className="flex justify-around px-3 pt-1.5 pb-[max(10px,env(safe-area-inset-bottom))] lg:flex-col lg:justify-start lg:gap-2 lg:px-2 lg:pt-6">
        {TABS.map(({ href, label, Icon }, index) => {
          const active = isActive(pathname, href);
          const dot = href === '/friends' && hasNew && !active;
          return (
            <Fragment key={href}>
            <li>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex h-13 w-16 flex-col items-center justify-center gap-0.5 rounded-fl text-note font-bold outline-none',
                  'lg:h-12 lg:w-full lg:flex-row lg:justify-start lg:gap-3 lg:px-4 lg:text-sm',
                  'focus-visible:ring-4 focus-visible:ring-teal/40',
                  // 選択中の文字は濃いティール（ティール10%の背景の上で 4.5 以上）
                  active ? 'bg-teal/10 text-brand' : 'text-fg-subtle',
                )}
              >
                <span className="relative">
                  <Icon aria-hidden className="size-6" strokeWidth={active ? 2.6 : 2.2} />
                  {dot && (
                    <span
                      data-testid="friends-new-badge"
                      aria-hidden
                      className="absolute -top-1.5 -right-3 flex h-4 min-w-4 items-center justify-center rounded-full bg-coral-strong px-1 text-note leading-none font-extrabold text-white ring-2 ring-surface"
                    >
                      {newCount === undefined ? '新' : newCount > 9 ? '9+' : newCount}
                    </span>
                  )}
                </span>
                {label}
                {dot && <span className="sr-only">{newCount === undefined ? '（新着あり）' : `（新着${newCount}件）`}</span>}
              </Link>
            </li>
            {index === 1 && (
              <li className="flex items-center lg:order-first lg:mb-2 lg:block">
                <button
                  type="button"
                  aria-label="記録を始める"
                  aria-haspopup="dialog"
                  onClick={() => setStarting(true)}
                  className="fl-thick flex size-14 items-center justify-center gap-2 rounded-full bg-teal-dark text-white outline-none [--thick:var(--color-teal-deep)] focus-visible:ring-4 focus-visible:ring-teal/40 lg:h-12 lg:w-full lg:rounded-fl lg:text-lg lg:font-extrabold lg:tracking-wider"
                >
                  <Plus aria-hidden className="size-7 lg:size-5" strokeWidth={3} />
                  <span aria-hidden className="hidden lg:inline">START</span>
                </button>
              </li>
            )}
            </Fragment>
          );
        })}
      </ul>
    </nav>
      {/* nav の transform の中に置くと fixed が効かないので、外に置く */}
      <StartSheet open={starting} onClose={() => setStarting(false)} />
    </>
  );
}
