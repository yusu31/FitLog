'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, User, Users } from 'lucide-react';
import { cn } from 'cn';

// 下のタブは3つ（docs/screen-design.md 1章）。選択中は色だけでなく aria-current と背景で示す
const TABS = [
  { href: '/today', label: '今日', Icon: Bell },
  { href: '/friends', label: '仲間', Icon: Users },
  { href: '/me', label: '自分', Icon: User },
] as const;

// 静的書き出しは trailingSlash: true なので、/friends と /friends/ の両方を同じタブとみなす
const isActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

export function TabBar() {
  const pathname = usePathname() ?? '';
  return (
    <nav aria-label="メイン" className="fixed bottom-0 left-1/2 z-10 w-full max-w-[430px] -translate-x-1/2 border-t-2 border-line bg-white">
      <ul className="flex justify-around px-3 pt-1.5 pb-[max(10px,env(safe-area-inset-bottom))]">
        {TABS.map(({ href, label, Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex h-13 w-21 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-bold outline-none',
                  'focus-visible:ring-4 focus-visible:ring-teal/40',
                  // 選択中の文字は濃いティール（ティール10%の背景の上で 4.5 以上）
                  active ? 'bg-teal/10 text-teal-deep' : 'text-sub',
                )}
              >
                <Icon aria-hidden className="size-6" strokeWidth={active ? 2.6 : 2.2} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
