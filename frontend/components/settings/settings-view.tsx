'use client';

import { ChevronLeft, ChevronRight, Info, LogOut, SquarePlus, Users } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { FullScreen } from '@/components/fitlog/full-screen';
import { ThickButton } from '@/components/fitlog/thick-button';
import { useGetCurrentGroup } from '@/lib/api/generated';
import { authClient } from '@/lib/auth-client';
import { clearCachedUser } from '@/lib/session-cache';
import { useAppSession } from '@/lib/use-app-session';
import { GROUP_MESSAGES } from '@/lib/messages';
import { useRequireSession } from '@/lib/use-require-session';

// S-31 設定（docs/screen-design.md 1章）。タブの無い全画面。
// ユーザー情報・グループ（S-32 へ）・キャラ（S-33）・クレジット（S-34）・ログアウト。
// キャラの編集は「できれば」の範囲なので、押せない見た目だけ置く（クレジットは F-31 を出すので S-34 へ）
export function SettingsView() {
  const router = useRouter();
  const { signedIn } = useRequireSession();
  const { data: session } = useAppSession();
  const group = useGetCurrentGroup({ query: { enabled: signedIn } });
  const [error, setError] = useState<string | null>(null);

  async function onSignOut() {
    setError(null);
    try {
      await authClient.signOut();
      clearCachedUser();
      router.replace('/login');
    } catch {
      setError(GROUP_MESSAGES.network);
    }
  }

  const user = session?.user;
  const groupLabel =
    group.data?.status === 200 ? group.data.data.name : group.data?.status === 404 ? 'グループに入っていません' : group.isError ? '読み込めませんでした' : null;

  return (
    <FullScreen>
      <header className="flex items-center gap-1 px-2 pt-3">
        <Link
          href="/me"
          aria-label="自分へ戻る"
          className="flex size-11 items-center justify-center rounded-fl text-sub-strong outline-none focus-visible:ring-4 focus-visible:ring-teal/40"
        >
          <ChevronLeft aria-hidden className="size-7" />
        </Link>
        <h1 className="text-[28px] font-extrabold">設定</h1>
      </header>

      <div className="space-y-5 px-4 pt-3 pb-10">
        {user && (
          <section aria-label="ユーザー情報" className="fl-slab flex items-center gap-3 px-4 py-3">
            <span
              aria-hidden
              className="flex size-12 shrink-0 items-center justify-center rounded-full bg-teal-dark text-xl font-extrabold text-white"
            >
              {Array.from(user.name)[0]}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-extrabold">{user.name}</p>
              <p className="truncate text-sm text-sub-strong">{user.email}</p>
            </div>
          </section>
        )}

        <section aria-labelledby="settings-list-heading">
          <h2 id="settings-list-heading" className="pb-2 text-xs font-bold tracking-widest text-sub">
            設定
          </h2>
          <ul className="space-y-2">
            <li>
              {groupLabel === null ? (
                <div aria-busy="true" aria-label="グループを読み込み中" className="h-16 animate-pulse rounded-fl bg-face" />
              ) : (
                <Link
                  href="/settings/group"
                  className="fl-slab flex min-h-16 items-center gap-3 px-4 py-2.5 outline-none focus-visible:ring-4 focus-visible:ring-teal/40"
                >
                  <RowIcon>
                    <Users aria-hidden className="size-5" />
                  </RowIcon>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-bold text-sub-strong">グループ</span>
                    <span className="block truncate font-extrabold">{groupLabel}</span>
                  </span>
                  <ChevronRight aria-hidden className="size-5 shrink-0 text-sub" />
                </Link>
              )}
            </li>
            <li>
              <Link
                href="/settings/credits"
                className="fl-slab flex min-h-16 items-center gap-3 px-4 py-2.5 outline-none focus-visible:ring-4 focus-visible:ring-teal/40"
              >
                <RowIcon>
                  <Info aria-hidden className="size-5" />
                </RowIcon>
                <span className="min-w-0 flex-1 truncate font-extrabold">クレジット</span>
                <ChevronRight aria-hidden className="size-5 shrink-0 text-sub" />
              </Link>
            </li>
          </ul>
        </section>

        <section aria-labelledby="add-to-home-heading" className="fl-slab space-y-2 px-4 py-3">
          <h2 id="add-to-home-heading" className="flex items-center gap-2 font-extrabold">
            <RowIcon>
              <SquarePlus aria-hidden className="size-5" />
            </RowIcon>
            ホーム画面に追加
          </h2>
          <p className="text-sm text-sub-strong">アプリのように、ホーム画面のアイコンからすぐ開けます。仲間の反応の通知を受け取るにも、この追加が前提です。</p>
          <dl className="space-y-1 text-sm">
            <div>
              <dt className="font-bold">Android（Chrome）</dt>
              <dd className="text-sub-strong">右上のメニュー（︙）から「ホーム画面に追加」または「アプリをインストール」を選びます。</dd>
            </div>
            <div>
              <dt className="font-bold">iPhone（Safari）</dt>
              <dd className="text-sub-strong">画面下の共有ボタン（□に↑）を押し、「ホーム画面に追加」を選びます。</dd>
            </div>
          </dl>
        </section>

        <div className="space-y-2">
          <ThickButton tone="white" onClick={onSignOut}>
            <LogOut aria-hidden />
            ログアウト
          </ThickButton>
          {error && (
            <p role="alert" className="rounded-lg bg-coral-light px-3 py-2 text-sm font-bold text-ink">
              {error}
            </p>
          )}
        </div>
      </div>
    </FullScreen>
  );
}

function RowIcon({ children, muted }: { children: ReactNode; muted?: boolean }) {
  return (
    <span
      className={`flex size-10 shrink-0 items-center justify-center rounded-full ${muted ? 'bg-face text-sub' : 'bg-teal-light text-teal-dark'}`}
    >
      {children}
    </span>
  );
}
