'use client';

import { Settings } from 'lucide-react';
import Link from 'next/link';
import { PageTitle } from '@/components/fitlog/app-shell';
import { Sprite } from '@/components/fitlog/sprite';
import { useGetCurrentGroup } from '@/lib/api/generated';
import { GROUP_MESSAGES } from '@/lib/messages';
import { FeedSection } from './feed-section';
import { GroupSummary, MemberList } from './member-list';
import { NoGroupGuide } from './no-group-guide';

// S-20 仲間（docs/screen-design.md 4章）。グループがないときは「作る」と「招待リンクで参加する」の2つだけ（NoGroupGuide）。
// 足跡・週の合計・スタンプ・コメントは FeedSection（feed-section.tsx）。招待・グループを出るは S-32（/settings/group）にある
export function FriendsView() {
  const { data, isPending, isError } = useGetCurrentGroup();

  return (
    <div className="relative">
      <PageTitle>なかま</PageTitle>
      <Sprite pose="idle" size={72} className="absolute top-0 right-4" />
      {isPending ? (
        <div aria-busy="true" aria-label="読み込み中" className="mx-4 mt-3 h-40 animate-pulse rounded-fl bg-face" />
      ) : isError || !data || (data.status !== 200 && data.status !== 404) ? (
        <p role="alert" className="mx-4 mt-4 rounded-fl bg-coral-light px-4 py-3 text-sm font-bold text-ink">
          {GROUP_MESSAGES.loadFailed}
        </p>
      ) : data.status === 404 ? (
        <NoGroupGuide />
      ) : (
        <div className="space-y-4 px-4 pt-3">
          <GroupSummary group={data.data} />
          <FeedSection />
          <MemberList group={data.data} />
          <Link
            href="/settings/group"
            className="fl-slab flex min-h-14 items-center gap-3 px-4 py-3 font-extrabold outline-none focus-visible:ring-4 focus-visible:ring-teal/40"
          >
            <Settings aria-hidden className="size-5 text-teal-dark" />
            グループの設定（招待リンク・出る）
          </Link>
        </div>
      )}
    </div>
  );
}
