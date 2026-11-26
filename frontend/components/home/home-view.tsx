'use client';

import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import { NotificationBell } from '@/components/fitlog/notification-bell';
import { PageTitle } from '@/components/fitlog/app-shell';
import { MyChara } from '@/components/fitlog/my-chara';
import { buttonClass } from '@/components/fitlog/thick-button';
import { FeedSection } from '@/components/friends/feed-section';
import { WeekVideoStrip } from '@/components/video-grid/week-video-strip';
import { useGetCurrentGroup, useGetWeek } from '@/lib/api/generated';
import { HOME_MESSAGES } from '@/lib/messages';
import { toLocalDate } from '@/lib/shared/local-date';

// S-05 ホーム（02-9 ⑫）。上＝自分のキャラと今日の1行、下＝仲間のタイムライン（畳める）。
// ベルは見出しと同じ行の右端（①）。タイムラインは仲間タブから移した（足跡の既読もここで付く）
export function HomeView() {
  return (
    <>
      <PageTitle action={<NotificationBell />}>ホーム</PageTitle>
      <div className="space-y-4 px-4 pt-3">
        <TodayLine />
        <Timeline />
      </div>
    </>
  );
}

// 自分のキャラと、今日の状態を1行で。記録の入口（記録タブ）へのリンクつき
function TodayLine() {
  const today = toLocalDate(new Date());
  const week = useGetWeek({ date: today });
  const status = week.data?.status === 200 ? (week.data.data.days.find((d) => d.date === today)?.status ?? 'none') : null;
  const text = status === 'rec' ? HOME_MESSAGES.todayRecorded : status === 'rest' ? HOME_MESSAGES.todayRest : HOME_MESSAGES.todayNone;
  return (
    <section aria-label="今日" className="fl-slab flex flex-wrap items-center gap-3 px-4 py-3">
      <MyChara pose={status === 'rec' ? 'cheer' : 'idle'} size={72} className="shrink-0" />
      <div className="min-w-0 flex-1 basis-32 space-y-2">
        <p className="font-extrabold">{status === null ? '　' : text}</p>
        <Link href="/log" className={buttonClass({ variant: 'secondary', size: 'sm' })}>
          記録を開く
        </Link>
      </div>
    </section>
  );
}

// 仲間のタイムライン。グループが無いときは、仲間タブ（招待・作成の入口）へ案内する。「畳める」は <details>（開閉の button を増やさない）
function Timeline() {
  const group = useGetCurrentGroup();
  const noGroup = group.data?.status === 404;
  const alone = group.data?.status === 200 && group.data.data.members.length <= 1;
  return (
    <details open className="group space-y-3">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between rounded-fl px-1 text-lg font-extrabold outline-none focus-visible:ring-4 focus-visible:ring-teal/40 [&::-webkit-details-marker]:hidden">
        {HOME_MESSAGES.timeline}
        <ChevronDown aria-hidden className="size-5 text-fg-muted transition-transform group-open:rotate-180" />
      </summary>
      {group.isPending ? (
        <div aria-busy="true" aria-label="読み込み中" className="h-40 animate-pulse rounded-fl bg-canvas" />
      ) : noGroup ? (
        <div className="fl-slab space-y-2 px-4 py-3">
          <p className="text-sm font-bold">{HOME_MESSAGES.noGroup}</p>
          <Link href="/friends" className={buttonClass({ variant: 'secondary', size: 'sm' })}>
            仲間を探す
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {!alone && <WeekVideoStrip />}
          <FeedSection hideEmptyTotals={alone} />
        </div>
      )}
    </details>
  );
}
