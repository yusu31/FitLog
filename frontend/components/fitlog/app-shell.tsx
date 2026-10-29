'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { authClient } from '@/lib/auth-client';
import { TabBar } from './tab-bar';

// タブのある画面（今日・仲間・自分）の枠。ログインしていなければ、戻り先つきでログイン画面へ移す。
// 静的書き出しなのでサーバーでは確かめられない。本当の守りは API 側のログイン必須（design.md 2章）で、ここは画面の案内。
export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() ?? '/today';
  const { data: session, isPending } = authClient.useSession();
  const signedOut = !isPending && !session;

  useEffect(() => {
    if (signedOut) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [signedOut, router, pathname]);

  return (
    <div className="min-h-dvh bg-[#e9ecef]">
      <div className="mx-auto flex min-h-dvh max-w-[430px] flex-col bg-white">
        {session ? (
          <main className="flex-1 pb-28">{children}</main>
        ) : (
          <main aria-busy="true" aria-label="読み込み中" className="flex-1 space-y-4 px-4 pt-8">
            <div className="h-8 w-28 animate-pulse rounded-lg bg-face" />
            <div className="h-40 animate-pulse rounded-xl bg-face" />
            <div className="h-16 animate-pulse rounded-xl bg-face" />
          </main>
        )}
        <TabBar />
      </div>
    </div>
  );
}

// 画面の見出し（v8 の .title）
export function PageTitle({ children }: { children: ReactNode }) {
  return <h1 className="px-4 pt-6 text-[28px] leading-tight font-black">{children}</h1>;
}
