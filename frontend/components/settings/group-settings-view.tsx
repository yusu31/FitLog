'use client';

import { buttonClass } from '@/components/fitlog/thick-button';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { CreateGroupForm } from '@/components/friends/create-group-form';
import { GROUP_MEMBER_MAX, GroupBand, MemberList } from '@/components/friends/member-list';
import { FullScreen } from '@/components/fitlog/full-screen';
import { MissionForm } from '@/components/friends/mission-form';
import { useGetCurrentGroup } from '@/lib/api/generated';
import { backTarget } from '@/lib/back-target';
import { GROUP_MESSAGES } from '@/lib/messages';
import { useRequireSession } from '@/lib/use-require-session';
import { InvitePanel } from './invite-panel';
import { LeaveGroup } from './leave-group';

// 1人1グループ・5人までの理由（要件。変えない）。A09-4
const LIMIT_REASON = '1人が入れるグループは1つ・5人までです。少人数で顔の見える見せ合いにするための決まりです。';

// S-32 グループの設定（docs/screen-design.md 1章）。タブの無い全画面。
// グループがなければ「グループを作る」、あれば メンバー・招待リンク・グループを出る
export function GroupSettingsView() {
  const { signedIn } = useRequireSession();
  // 仲間タブの「招待」から来たら仲間へ、設定から来たら設定へ戻す（N5）
  const back = backTarget(useSearchParams().get('back'), ['friends'], { href: '/settings', label: '設定へ戻る' });
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
          href={back.href}
          aria-label={back.label}
          className={buttonClass({ variant: 'icon' }, '[&_svg]:size-7')}
        >
          <ChevronLeft aria-hidden className="size-7" />
        </Link>
        <h1 className="text-page-title font-extrabold">グループの設定</h1>
      </header>

      <div className="space-y-4 px-4 pt-3 pb-10">
        {loading ? (
          <div aria-busy="true" aria-label="読み込み中" className="space-y-3">
            <div className="h-36 animate-pulse rounded-fl bg-canvas" />
            <div className="h-16 animate-pulse rounded-fl bg-canvas" />
          </div>
        ) : isError || !data || (!group && !notInGroup) ? (
          <p role="alert" className="rounded-fl bg-coral-light px-4 py-3 text-sm font-bold text-fg">
            {GROUP_MESSAGES.loadFailed}
          </p>
        ) : group ? (
          <>
            {justCreated && (
              <p role="status" className="rounded-fl bg-teal-light px-4 py-3 text-sm font-extrabold text-fg">
                グループを作りました。つぎは、招待リンクを作って仲間に送ろう
              </p>
            )}
            <GroupBand group={group} withInvite={false} />
            <MissionForm key={`${group.name}|${group.description}|${group.background}`} group={group} />
            <MemberList group={group} />
            <p className="text-note text-fg-muted [word-break:auto-phrase]">{LIMIT_REASON}</p>
            <InvitePanel full={group.members.length >= GROUP_MEMBER_MAX} />
            <LeaveGroup onLeft={() => setJustCreated(false)} />
          </>
        ) : (
          <section aria-labelledby="create-heading" className="space-y-3">
            <div>
              <h2 id="create-heading" className="text-xl font-extrabold">
                グループを作る
              </h2>
              <p className="mt-1 text-sm text-fg-muted [word-break:auto-phrase]">
                1つのグループには、あなたを入れて{GROUP_MEMBER_MAX}人まで入れます。作ったあとに、招待リンクで仲間を呼べます。
              </p>
              <p className="mt-1 text-note text-fg-muted [word-break:auto-phrase]">{LIMIT_REASON}
              </p>
            </div>
            <CreateGroupForm onCreated={() => setJustCreated(true)} />
          </section>
        )}
      </div>
    </FullScreen>
  );
}
