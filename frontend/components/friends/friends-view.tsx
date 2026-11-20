'use client';

import { Settings } from 'lucide-react';
import Link from 'next/link';
import { PageTitle } from '@/components/fitlog/app-shell';
import { Sprite } from '@/components/fitlog/sprite';
import { useGetCurrentGroup } from '@/lib/api/generated';
import { WeekVideoStrip } from '@/components/video-grid/week-video-strip';
import { InvitePanel } from '@/components/settings/invite-panel';
import { GROUP_MESSAGES } from '@/lib/messages';
import { FeedSection } from './feed-section';
import { FRIENDS_TEXT } from './friends-text';
import { GroupBand } from './member-list';
import { NoGroupGuide } from './no-group-guide';

// S-20 仲間（docs/screen-design.md 4章）。グループがないときは「作る」と「招待リンクで参加する」の2つだけ（NoGroupGuide）。
// 足跡・週の合計・スタンプ・コメントは FeedSection（feed-section.tsx）。招待・グループを出るは S-32（/settings/group）にある
export function FriendsView() {
  const { data, isPending, isError } = useGetCurrentGroup();
  const alone = data?.status === 200 && data.data.members.length <= 1;

  return (
    <div className="relative">
      <PageTitle>なかま</PageTitle>
      <Sprite pose="idle" size={72} className="absolute top-0 right-4" />
      {isPending ? (
        <div aria-busy="true" aria-label="読み込み中" className="mx-4 mt-3 h-40 animate-pulse rounded-fl bg-canvas" />
      ) : isError || !data || (data.status !== 200 && data.status !== 404) ? (
        <p role="alert" className="mx-4 mt-4 rounded-fl bg-coral-light px-4 py-3 text-sm font-bold text-fg">
          {GROUP_MESSAGES.loadFailed}
        </p>
      ) : data.status === 404 ? (
        <NoGroupGuide />
      ) : (
        <div className="space-y-4 px-4 pt-3">
          {alone ? (
            /* 自分1人の間は、帯も空の統計も出さず、キャラの絵と次の一手「仲間を招待」だけ（N6・D7-5） */
            <section className="flex flex-col items-center gap-1 pt-2">
              <Sprite pose="welcome" size={96} />
              <p className="text-base font-extrabold">{FRIENDS_TEXT.aloneTitle}</p>
              <div className="w-full pt-2">
                <InvitePanel full={false} />
              </div>
            </section>
          ) : (
            <GroupBand group={data.data} />
          )}
          <WeekVideoStrip />
          <FeedSection hideEmptyTotals={alone} />
          <Link
            href="/settings/group"
            className="fl-slab flex min-h-14 items-center gap-3 px-4 py-3 font-extrabold outline-none focus-visible:ring-4 focus-visible:ring-teal/40"
          >
            <Settings aria-hidden className="size-5 text-brand" />
            {FRIENDS_TEXT.groupSettings}
          </Link>
        </div>
      )}
    </div>
  );
}
