'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { cn } from 'cn';
import { useAppSession } from '@/lib/use-app-session';
import { SyncBanner } from './sync-banner';
import { TabBar } from './tab-bar';

// タブのある画面（今日・仲間・自分）の枠。ログインしていなければ、戻り先つきでログイン画面へ移す。
// 静的書き出しなのでサーバーでは確かめられない。本当の守りは API 側のログイン必須（design.md 2章）で、ここは画面の案内。
// syncBanner: 送信待ちの帯を枠の上部に出すか。今日の画面は「週の帯のすぐ下」に自分で置くので false
export function AppShell({ children, syncBanner = true }: { children: ReactNode; syncBanner?: boolean }) {
  const router = useRouter();
  const pathname = usePathname() ?? '/today';
  const { data: session, isPending } = useAppSession();
  const signedOut = !isPending && !session;

  useEffect(() => {
    if (signedOut) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [signedOut, router, pathname]);

  return (
    <div className="min-h-dvh bg-line">
      <div className="mx-auto flex min-h-dvh max-w-[430px] flex-col bg-canvas">
        {session ? (
          <main className="flex-1 pb-28">
            {syncBanner && <SyncBanner />}
            {children}
          </main>
        ) : (
          <main aria-busy="true" aria-label="読み込み中" className="flex-1 space-y-4 px-4 pt-8">
            <div className="h-8 w-28 animate-pulse rounded-lg bg-canvas" />
            <div className="h-40 animate-pulse rounded-fl bg-canvas" />
            <div className="h-16 animate-pulse rounded-fl bg-canvas" />
            <WakingNote />
          </main>
        )}
        <TabBar signedIn={Boolean(session)} />
      </div>
    </div>
  );
}

// 画面の見出し（v8 の .title）
// reserveCorner: 右上にキャラ（Sprite placement="corner"）を置く画面は、見出しの右を空けて重ならないようにする
export function PageTitle({ children, reserveCorner = false }: { children: ReactNode; reserveCorner?: boolean }) {
  return <h1 className={cn('px-4 pt-[18px] text-page-title font-extrabold', reserveCorner && 'pr-24')}>{children}</h1>;
}

// S1: 少人数のアプリは利用の間隔が空き、API（Lambda）が眠っていて最初の確認に5秒前後かかる。
// 3秒を超えたら、止まったのではなく待てば進むことを伝える（設定は変えず、無料のまま）
const WAKING_DELAY_MS = 3000;

function WakingNote() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShow(true), WAKING_DELAY_MS);
    return () => clearTimeout(t);
  }, []);
  if (!show) return null;
  return (
    <p role="status" className="rounded-fl bg-teal-light px-4 py-3 text-sm font-extrabold text-fg">
      サーバーを起こしています。数秒お待ちください
    </p>
  );
}
