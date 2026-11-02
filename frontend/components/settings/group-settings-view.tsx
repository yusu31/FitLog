'use client';

import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { CreateGroupForm } from '@/components/friends/create-group-form';
import { GROUP_MEMBER_MAX, GroupSummary, MemberList } from '@/components/friends/member-list';
import { FullScreen } from '@/components/fitlog/full-screen';
import { useGetCurrentGroup } from '@/lib/api/generated';
import { GROUP_MESSAGES } from '@/lib/messages';
import { useRequireSession } from '@/lib/use-require-session';
import { InvitePanel } from './invite-panel';
import { LeaveGroup } from './leave-group';

// S-32 グループの設定（docs/screen-design.md 1章）。タブの無い全画面。
// グループがなければ「グループを作る」、あれば メンバー・招待リンク・グループを出る
export function GroupSettingsView() {
  const { signedIn } = useRequireSession();
  const { data, isPending, isError } = useGetCurrentGroup({ query: { enabled: signedIn } });
  // 作った直後だけ「つぎは招待リンク」の案内を出す
  const [justCreated, setJustCreated] = useState(false);

  const loading = !signedIn || isPending;
  const group = data?.status === 200 ? data.data : null;
  const notInGroup = data?.status === 404;

  return (
    <FullScreen>
      <header className="flex items-center gap-1 px-2 pt-3">
        <Link
          href="/settings"
          aria-label="設定へ戻る"
          className="flex size-11 items-center justify-center rounded-fl text-sub-strong outline-none focus-visible:ring-4 focus-visible:ring-teal/40"
        >
          <ChevronLeft aria-hidden className="size-7" />
        </Link>
        <h1 className="text-[28px] font-extrabold">グループの設定</h1>
      </header>

      <div className="space-y-4 px-4 pt-3 pb-10">
        {loading ? (
          <div aria-busy="true" aria-label="読み込み中" className="space-y-3">
            <div className="h-36 animate-pulse rounded-fl bg-face" />
            <div className="h-16 animate-pulse rounded-fl bg-face" />
          </div>
        ) : isError || !data || (!group && !notInGroup) ? (
          <p role="alert" className="rounded-fl bg-coral-light px-4 py-3 text-sm font-bold text-ink">
            {GROUP_MESSAGES.loadFailed}
          </p>
        ) : group ? (
          <>
            {justCreated && (
              <p role="status" className="rounded-fl bg-teal-light px-4 py-3 text-sm font-extrabold text-ink">
                グループを作りました。つぎは、招待リンクを作って仲間に送ろう
              </p>
            )}
            <GroupSummary group={group} />
            <MemberList group={group} />
            <InvitePanel full={group.members.length >= GROUP_MEMBER_MAX} />
            <LeaveGroup onLeft={() => setJustCreated(false)} />
          </>
        ) : (
          <section aria-labelledby="create-heading" className="space-y-3">
            <div>
              <h2 id="create-heading" className="text-xl font-extrabold">
                グループを作る
              </h2>
              <p className="mt-1 text-sm text-sub-strong [word-break:auto-phrase]">
                1つのグループには、あなたを入れて{GROUP_MEMBER_MAX}人まで入れます。作ったあとに、招待リンクで仲間を呼べます。
              </p>
            </div>
            <CreateGroupForm onCreated={() => setJustCreated(true)} />
          </section>
        )}
      </div>
    </FullScreen>
  );
}
