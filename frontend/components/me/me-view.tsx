'use client';

import { ListChecks, Settings } from 'lucide-react';
import Link from 'next/link';
import { PageTitle } from '@/components/fitlog/app-shell';
import { Avatar } from '@/components/fitlog/avatar';
import { MyVideoGrid } from '@/components/video-grid/my-video-grid';
import { useListRecords } from '@/lib/api/generated';
import { toLocalDate } from '@/lib/shared/local-date';
import { useAppSession } from '@/lib/use-app-session';
import { isRunHeavyWeek } from '@/lib/week-focus';
import { BodySummary } from './body-summary';
import { HeatmapSection } from './heatmap-section';
import { PAGE_SIZE, RecordsList } from './records-list';
import { WeekRunSection } from './week-run-section';

// S-30 自分（docs/screen-design.md 4章）。記録の一覧には「…」から削除がある。「記録のまとめ」は /me/stats（S-35）へのリンク。
// 「設定」は /settings へのリンク。ログアウトは設定（S-31）にだけ置く（自分タブで目立つと押し間違えるため）
export function MeView() {
  const { data: session } = useAppSession();
  // 記録の一覧の1ページ目（RecordsList と同じ呼び出し。TanStack Query が1回分を共有する）で、今週ランが多い人かを見る（N9）
  const first = useListRecords({ limit: PAGE_SIZE });
  const items = first.data?.status === 200 ? first.data.data.items : [];
  const runHeavy = isRunHeavyWeek(items, toLocalDate(new Date()));

  return (
    <>
      <PageTitle>じぶん</PageTitle>
      <div className="space-y-4 px-4 pt-3">
        <section className="fl-slab flex items-center gap-3 px-4 py-3">
          <Avatar shirtColor="teal" size={48} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-extrabold">{session?.user.name}</p>
          </div>
          {/* 設定の画面（S-31 /settings）は別の担当が作る。ここはリンクだけ。ThickButton（white・sm）と同じ見た目 */}
          <Link
            href="/settings"
            className="fl-thick inline-flex min-h-11 items-center justify-center gap-2 rounded-fl border-2 border-teal-light bg-surface px-4 text-sm font-extrabold tracking-wide text-brand outline-none [--thick:#b8e3e4] focus-visible:ring-4 focus-visible:ring-teal/40 [&_svg]:size-5 [&_svg]:shrink-0"
          >
            <Settings aria-hidden />
            設定
          </Link>
        </section>

        {/* S-35 記録のまとめ（A08-1: 見つけにくかったので、名前のすぐ下＝画面の上部に置く）。ThickButton（white・lg）と同じ見た目のリンク */}
        <Link
          href="/me/stats"
          className="fl-thick inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-fl border-2 border-teal-light bg-surface px-5 text-lg font-extrabold tracking-wider text-brand outline-none [--thick:#b8e3e4] focus-visible:ring-4 focus-visible:ring-teal/40 [&_svg]:size-5 [&_svg]:shrink-0"
        >
          <ListChecks aria-hidden />
          記録のまとめ
        </Link>

        <BodySummary />

        {runHeavy && <WeekRunSection />}

        <HeatmapSection />

        <MyVideoGrid />

        <RecordsList />
      </div>
    </>
  );
}
