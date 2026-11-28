'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Fragment } from 'react';
import { ClipboardList, House, User, Users } from 'lucide-react';
import { cn } from 'cn';
import { useGetFeedUnread } from '@/lib/api/generated';
import { FriendToast } from './friend-toast';
import { StartFan } from './start-fan';

// 下のタブは4つ＋中央の＋（docs/screen-design.md 1章）: ホーム・記録・（＋）・仲間・自分。選択中は色だけでなく aria-current と背景で示す。
// 自分（/me）は /me/posts・/me/profile など、その下の画面でも選択中にする
const TABS = [
  { href: '/home', label: 'ホーム', Icon: House },
  { href: '/log', label: '記録', Icon: ClipboardList },
  { href: '/friends', label: '仲間', Icon: Users },
  { href: '/me', label: '自分', Icon: User },
] as const;

// 静的書き出しは trailingSlash: true なので、/friends と /friends/ の両方を同じタブとみなす
const isActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

// 新着の印（F4）。ログインしているときだけ GET /feed/unread を見て、「ホーム」（仲間の足跡が流れる所）に点を出す。
// ホームを開いている間は出さない（見ている最中。足跡が読めたら「見た」を送り、点の元の値も false にする）。
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
    <>
    <nav aria-label="メイン" className="fixed bottom-0 left-1/2 z-10 w-full max-w-[430px] -translate-x-1/2 border-t-2 border-line bg-surface pc:sticky pc:top-0 pc:bottom-auto pc:left-auto pc:order-first pc:h-dvh pc:w-56 pc:shrink-0 pc:translate-x-0 pc:self-start pc:border-t-0 pc:bg-transparent">
      <ul className="flex justify-around px-3 pt-1.5 max-[239px]:px-1 pb-[max(10px,env(safe-area-inset-bottom))] short:pt-1 short:pb-[max(4px,env(safe-area-inset-bottom))] pc:flex-col pc:justify-start pc:gap-2 pc:px-2 pc:pt-6">
        {TABS.map(({ href, label, Icon }, index) => {
          const active = isActive(pathname, href);
          const dot = href === '/home' && hasNew && !active;
          return (
            <Fragment key={href}>
            <li className="min-w-0 max-w-16 flex-1 pc:max-w-none pc:flex-none">
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex h-13 short:h-11 w-full flex-col items-center justify-center gap-0.5 rounded-fl text-note font-bold outline-none',
                  'pc:h-12 pc:w-full pc:flex-row pc:justify-start pc:gap-3 pc:px-4 pc:text-sm',
                  'focus-visible:ring-4 focus-visible:ring-teal/40',
                  // 選択中の文字は濃いティール（ティール10%の背景の上で 4.5 以上）
                  // PC（lg）のメニューは灰色の地の上なので、選択中は白い面・ほかは濃いめの文字にして 4.5:1 を保つ
                  active ? 'bg-teal/10 text-brand pc:bg-surface' : 'text-fg-subtle pc:text-fg-muted',
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
                {/* 195px 幅など狭い画面では文字を消してアイコンだけにする（読み上げ用の名前は残す） */}
                <span className="max-[239px]:sr-only">{label}</span>
                {dot && <span className="sr-only">{newCount === undefined ? '（新着あり）' : `（新着${newCount}件）`}</span>}
              </Link>
            </li>
            {index === 1 && <StartFan />}
            </Fragment>
          );
        })}
      </ul>
    </nav>
    {signedIn && <FriendToast latest={unread.data?.status === 200 ? unread.data.data.latestFriendRecord : undefined} loaded={unread.data?.status === 200} />}
    </>
  );
}
