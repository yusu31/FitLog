'use client';

import { ListChecks, Settings } from 'lucide-react';
import Link from 'next/link';
import { PageTitle } from '@/components/fitlog/app-shell';
import { useAppSession } from '@/lib/use-app-session';
import { HeatmapSection } from './heatmap-section';
import { RecordsList } from './records-list';

// S-30 自分（docs/screen-design.md 4章）。記録の一覧には「…」から削除がある。「記録をくわしく」は /me/stats（S-35）へのリンク。
// 「設定」は /settings へのリンク。ログアウトは設定（S-31）にだけ置く（自分タブで目立つと押し間違えるため）
export function MeView() {
  const { data: session } = useAppSession();

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

        <HeatmapSection />

        <RecordsList />

        {/* S-35 記録をくわしく。ThickButton（white・lg）と同じ見た目のリンク */}
        <Link
          href="/me/stats"
          className="fl-thick inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-fl border-2 border-teal-light bg-white px-5 text-lg font-extrabold tracking-wider text-teal-dark outline-none [--thick:#b8e3e4] focus-visible:ring-4 focus-visible:ring-teal/40 [&_svg]:size-5 [&_svg]:shrink-0"
        >
          <ListChecks aria-hidden />
          記録をくわしく
        </Link>

      </div>
    </>
  );
}
