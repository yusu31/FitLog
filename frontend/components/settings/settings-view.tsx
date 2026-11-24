'use client';

import { ChevronLeft, ChevronRight, CircleHelp, Info, LogOut, UserRound, Users } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useSyncExternalStore, type ReactNode } from 'react';
import { FullScreen } from '@/components/fitlog/full-screen';
import { ThickButton } from '@/components/fitlog/thick-button';
import { Segmented } from '@/components/ui/segmented';
import { AddToHome } from './add-to-home';
import { DeleteAccount } from './delete-account';
import { ExportRecords } from './export-records';
import { InlineNameEdit } from './inline-name-edit';
import { PreferencesSection } from './preferences-section';
import { readTheme, saveTheme, subscribeTheme, THEME_OPTIONS, type ThemeMode } from '@/lib/theme';
import { useGetCurrentGroup } from '@/lib/api/generated';
import { authClient } from '@/lib/auth-client';
import { clearCachedUser } from '@/lib/session-cache';
import { useAppSession } from '@/lib/use-app-session';
import { GROUP_MESSAGES } from '@/lib/messages';
import { useRequireSession } from '@/lib/use-require-session';

// S-31 設定（docs/screen-design.md 1章）。タブの無い全画面。
// ユーザー情報・アカウント（ログアウト・退会）・グループ（S-32 へ）・ヘルプ・クレジット（S-34）。
// キャラの編集は「できれば」の範囲なので、押せない見た目だけ置く（クレジットは F-31 を出すので S-34 へ）
export function SettingsView() {
  const router = useRouter();
  const { signedIn } = useRequireSession();
  const { data: session } = useAppSession();
  const group = useGetCurrentGroup({ query: { enabled: signedIn } });
  const [error, setError] = useState<string | null>(null);
  const theme = useSyncExternalStore(subscribeTheme, readTheme, () => 'light' as ThemeMode);

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
          className="flex size-11 items-center justify-center rounded-fl text-fg-muted outline-none focus-visible:ring-4 focus-visible:ring-teal/40"
        >
          <ChevronLeft aria-hidden className="size-7" />
        </Link>
        <h1 className="text-page-title font-extrabold">設定</h1>
      </header>

      <div className="space-y-5 px-4 pt-3 pb-28">
        {user && <InlineNameEdit key={user.name} initialName={user.name} email={user.email} />}

        <section aria-labelledby="account-heading" className="space-y-2">
          <h2 id="account-heading" className="text-note font-bold tracking-widest text-fg-subtle">
            アカウント
          </h2>
          <ul className="space-y-2">
            <li>
              <Link
                href="/settings/account"
                className="fl-slab flex min-h-16 items-center gap-3 px-4 py-2.5 outline-none focus-visible:ring-4 focus-visible:ring-teal/40"
              >
                <RowIcon>
                  <UserRound aria-hidden className="size-5" />
                </RowIcon>
                <span className="min-w-0 flex-1 truncate font-extrabold">アカウントの設定</span>
                <ChevronRight aria-hidden className="size-5 shrink-0 text-fg-subtle" />
              </Link>
            </li>
          </ul>
          <ThickButton tone="white" onClick={onSignOut}>
            <LogOut aria-hidden />
            ログアウト
          </ThickButton>
          {error && (
            <p role="alert" className="rounded-lg bg-coral-light px-3 py-2 text-sm font-bold text-fg">
              {error}
            </p>
          )}
          {/* 退会はログアウトのすぐ下（一番下までスクロールしなくても見つかる） */}
          <DeleteAccount />
        </section>

        <section aria-labelledby="settings-list-heading">
          <h2 id="settings-list-heading" className="pb-2 text-note font-bold tracking-widest text-fg-subtle">
            設定
          </h2>
          <ul className="space-y-2">
            <li>
              {groupLabel === null ? (
                <div aria-busy="true" aria-label="グループを読み込み中" className="h-16 animate-pulse rounded-fl bg-canvas" />
              ) : (
                <Link
                  href="/settings/group"
                  className="fl-slab flex min-h-16 items-center gap-3 px-4 py-2.5 outline-none focus-visible:ring-4 focus-visible:ring-teal/40"
                >
                  <RowIcon>
                    <Users aria-hidden className="size-5" />
                  </RowIcon>
                  <span className="min-w-0 flex-1">
                    <span className="block text-note font-bold text-fg-muted">グループ</span>
                    <span className="block truncate font-extrabold">{groupLabel}</span>
                  </span>
                  <ChevronRight aria-hidden className="size-5 shrink-0 text-fg-subtle" />
                </Link>
              )}
            </li>
            <li>
              <Link
                href="/settings/help"
                className="fl-slab flex min-h-16 items-center gap-3 px-4 py-2.5 outline-none focus-visible:ring-4 focus-visible:ring-teal/40"
              >
                <RowIcon>
                  <CircleHelp aria-hidden className="size-5" />
                </RowIcon>
                <span className="min-w-0 flex-1 truncate font-extrabold">ヘルプ・使い方</span>
                <ChevronRight aria-hidden className="size-5 shrink-0 text-fg-subtle" />
              </Link>
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
                <ChevronRight aria-hidden className="size-5 shrink-0 text-fg-subtle" />
              </Link>
            </li>
          </ul>
        </section>

        <section aria-labelledby="appearance-heading" className="space-y-2">
          <h2 id="appearance-heading" className="text-note font-bold tracking-widest text-fg-subtle">
            画面の色
          </h2>
          <Segmented
            legend="見た目"
            options={THEME_OPTIONS}
            value={theme}
            onChange={(mode) => {
              saveTheme(mode);
            }}
          />
        </section>

        <PreferencesSection />

        <AddToHome />

        <ExportRecords />

      </div>
    </FullScreen>
  );
}

function RowIcon({ children, muted }: { children: ReactNode; muted?: boolean }) {
  return (
    <span
      className={`flex size-10 shrink-0 items-center justify-center rounded-full ${muted ? 'bg-canvas text-fg-subtle' : 'bg-teal-light text-brand'}`}
    >
      {children}
    </span>
  );
}
