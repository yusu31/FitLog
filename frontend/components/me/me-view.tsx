'use client';

import { ListChecks, LogOut, Settings } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { PageTitle } from '@/components/fitlog/app-shell';
import { ThickButton } from '@/components/fitlog/thick-button';
import { authClient } from '@/lib/auth-client';
import { RecordsList } from './records-list';

// S-30 自分（docs/screen-design.md 4章）。記録の一覧には「…」から削除がある。ヒートマップ（02-4）・「記録をくわしく」はまだなので、導線は見た目だけ（押せない）。
// 「設定」は /settings へのリンク。ログアウトは本来 S-31 設定に置くが、設定の画面ができるまでここに置く
export function MeView() {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const [error, setError] = useState<string | null>(null);

  async function onSignOut() {
    setError(null);
    try {
      await authClient.signOut();
      router.replace('/login');
    } catch {
      setError('通信に失敗しました。電波の良い所でもう一度お試しください');
    }
  }

  return (
    <>
      <PageTitle>じぶん</PageTitle>
      <div className="space-y-4 px-4 pt-3">
        <section className="fl-slab flex items-center gap-3 px-4 py-3">
          <span
            aria-hidden
            className="flex size-12 shrink-0 items-center justify-center rounded-full bg-teal-dark text-xl font-extrabold text-white"
          >
            {session ? Array.from(session.user.name)[0] : ''}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-extrabold">{session?.user.name}</p>
          </div>
          {/* 設定の画面（S-31 /settings）は別の担当が作る。ここはリンクだけ。ThickButton（white・sm）と同じ見た目 */}
          <Link
            href="/settings"
            className="fl-thick inline-flex min-h-11 items-center justify-center gap-2 rounded-fl border-2 border-teal-light bg-white px-4 text-sm font-extrabold tracking-wide text-teal-dark outline-none [--thick:#b8e3e4] focus-visible:ring-4 focus-visible:ring-teal/40 [&_svg]:size-5 [&_svg]:shrink-0"
          >
            <Settings aria-hidden />
            設定
          </Link>
        </section>

        {/* ヒートマップは 02-4 で作る。場所と見出しだけ置く */}
        <section aria-labelledby="heat-heading" className="fl-slab px-4 py-3">
          <h2 id="heat-heading" className="text-sm font-extrabold text-sub-strong">
            今週きたえたところ
          </h2>
          <p className="mt-2 rounded-lg bg-face px-3 py-6 text-center text-sm font-bold text-sub-strong">
            体の図は、もうすぐ出ます
          </p>
        </section>

        <RecordsList />

        {/* 記録の詳細・削除はまだない。押せない */}
        <ThickButton tone="white" disabled>
          <ListChecks aria-hidden />
          記録をくわしく
        </ThickButton>

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
    </>
  );
}
