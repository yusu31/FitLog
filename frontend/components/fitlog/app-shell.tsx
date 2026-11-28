'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { cn } from 'cn';
import { clearJustSignedIn, loginRedirectPath } from '@/lib/login-failure';
import { useAppSession } from '@/lib/use-app-session';
import { PhoneViewSwitch } from './phone-view-switch';
import { SideFriends } from './side-friends';
import { SyncBanner } from './sync-banner';
import { TabBar } from './tab-bar';

// タブのある画面（ホーム・記録・仲間・自分）の枠。ログインしていなければ、戻り先つきでログイン画面へ移す。
// 静的書き出しなのでサーバーでは確かめられない。本当の守りは API 側のログイン必須（design.md 2章）で、ここは画面の案内。
// syncBanner: 送信待ちの帯を枠の上部に出すか。記録の画面は「週の帯のすぐ下」に自分で置くので false
export function AppShell({ children, syncBanner = true }: { children: ReactNode; syncBanner?: boolean }) {
  const router = useRouter();
  const pathname = usePathname() ?? '/home';
  const { data: session, isPending } = useAppSession();
  const signedOut = !isPending && !session;

  useEffect(() => {
    if (signedOut) router.replace(loginRedirectPath(pathname));
  }, [signedOut, router, pathname]);

  // セッションが取れたら、ログイン直後の印はもう要らない
  useEffect(() => {
    if (session && !isPending) clearJustSignedIn();
  }, [session, isPending]);

  return (
    <div className="min-h-dvh bg-line">
      {/* PC（lg 以上）は 左=タブのメニュー・中央=画面（600px まで）・右=仲間の今日 の3列。スマホは今のまま */}
      <div className="mx-auto pc:flex pc:max-w-[1200px] pc:justify-center pc:gap-6 pc:px-6">
      <div className="relative mx-auto flex min-h-dvh max-w-[430px] flex-col bg-canvas pc:mx-0 pc:w-full pc:max-w-[600px]">
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
      </div>
      {/* メニューは3列の行の直下に置く（中央の列の中だと縦に積まれて中身が下へ押し出される）。スマホでは fixed なので位置は変わらない */}
      <TabBar signedIn={Boolean(session)} />
      {session && <SideFriends />}
      {session && <PhoneViewSwitch />}
      </div>
    </div>
  );
}

// 画面の見出し（v8 の .title）
// reserveCorner: 右上にキャラ（Sprite placement="corner"）を置く画面は、見出しの右を空けて重ならないようにする
// action: 見出しと同じ行の右端に置く部品（ホームの通知のベル。①）
export function PageTitle({ children, reserveCorner = false, action }: { children: ReactNode; reserveCorner?: boolean; action?: ReactNode }) {
  const h1 = <h1 className={cn('px-4 pt-[18px] text-page-title font-extrabold', reserveCorner && 'pr-24')}>{children}</h1>;
  if (!action) return h1;
  return (
    <div className="flex items-end justify-between gap-2 pr-3">
      {h1}
      <div className="shrink-0 pt-2">{action}</div>
    </div>
  );
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
