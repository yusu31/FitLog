'use client';

import { ChevronLeft, ChevronRight, Info, LogOut, Palette, Users } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { FullScreen } from '@/components/fitlog/full-screen';
import { ThickButton } from '@/components/fitlog/thick-button';
import { useGetCurrentGroup } from '@/lib/api/generated';
import { authClient } from '@/lib/auth-client';
import { GROUP_MESSAGES } from '@/lib/messages';
import { useRequireSession } from '@/lib/use-require-session';

// S-31 設定（docs/screen-design.md 1章）。タブの無い全画面。
// ユーザー情報・グループ（S-32 へ）・キャラ（S-33）・クレジット（S-34）・ログアウト。
// キャラとクレジットは「できれば」の範囲なので、押せない見た目だけ置く
export function SettingsView() {
  const router = useRouter();
  const { signedIn } = useRequireSession();
  const { data: session } = authClient.useSession();
  const group = useGetCurrentGroup({ query: { enabled: signedIn } });
  const [error, setError] = useState<string | null>(null);

  async function onSignOut() {
    setError(null);
    try {
      await authClient.signOut();
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
              <ComingSoonRow icon={<Palette aria-hidden className="size-5" />} label="キャラの編集" />
            </li>
            <li>
              <ComingSoonRow icon={<Info aria-hidden className="size-5" />} label="クレジット" />
            </li>
          </ul>
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

// 「できれば」の範囲の行。リンクにせず、押せない（disabled）ことを見た目と読み上げで伝える
function ComingSoonRow({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <button
      type="button"
      disabled
      className="fl-slab flex min-h-16 w-full items-center gap-3 border-line bg-face px-4 py-2.5 text-left opacity-70"
    >
      <RowIcon muted>{icon}</RowIcon>
      <span className="min-w-0 flex-1 truncate font-extrabold">{label}</span>
      <span className="fl-tag bg-line text-sub-strong">準備中</span>
    </button>
  );
}
