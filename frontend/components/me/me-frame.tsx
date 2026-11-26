'use client';

import { Settings } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { cn } from 'cn';
import { PageTitle } from '@/components/fitlog/app-shell';

// 自分タブの枠（02-9 ⑫）。見出し「自分」と右上の設定（歯車）、その下に3つのタブ: レポート（/me）・投稿（/me/posts）・プロフィール（/me/profile）。
// 設定の画面（S-31 /settings）への入口はここだけ。ログアウトも設定にだけ置く（押し間違えるため）
const ME_TABS = [
  { href: '/me', label: 'レポート' },
  { href: '/me/posts', label: '投稿' },
  { href: '/me/profile', label: 'プロフィール' },
] as const;

// 静的書き出しは trailingSlash: true なので、末尾の / はそろえて比べる
const norm = (p: string) => (p.length > 1 ? p.replace(/\/$/, '') : p);

export function MeFrame({ children }: { children: ReactNode }) {
  const pathname = norm(usePathname() ?? '/me');
  return (
    <>
      <PageTitle
        action={
          <Link
            href="/settings"
            aria-label="設定"
            className="flex size-11 items-center justify-center rounded-full text-fg-muted outline-none focus-visible:ring-4 focus-visible:ring-teal/40"
          >
            <Settings aria-hidden className="size-6" />
          </Link>
        }
      >
        自分
      </PageTitle>
      <nav aria-label="自分の画面" className="px-4 pt-3">
        <ul className="flex flex-wrap gap-2">
          {ME_TABS.map(({ href, label }) => {
            const active = pathname === href;
            return (
              <li key={href} className="min-w-0 flex-1 basis-24">
                <Link
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex min-h-11 items-center justify-center rounded-fl border-2 px-1 text-sm font-extrabold outline-none focus-visible:ring-4 focus-visible:ring-teal/40',
                    active ? 'border-teal-dark bg-teal-dark text-white' : 'border-teal-light bg-surface text-brand',
                  )}
                >
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="space-y-4 px-4 pt-4 pb-10">{children}</div>
    </>
  );
}
