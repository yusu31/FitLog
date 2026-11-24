'use client';

import { Users } from 'lucide-react';
import Link from 'next/link';
import { withBack } from '@/lib/back-target';
import { Avatar, AVATAR_BG } from '@/components/fitlog/avatar';
import { useAppSession } from '@/lib/use-app-session';
import type { GroupDetailResponse } from '@/lib/api/generated';

export const GROUP_MEMBER_MAX = 5;

// 丸の色の表は fitlog/avatar.tsx に移した（顔の丸 Avatar と同じ表を使う）。既存の import を壊さないため、ここからも出す
export { AVATAR_BG };

// 仲間タブ（S-20）とグループの設定（S-32）の上の1行の帯（D7-4）。グループ名・人数・招待への入口だけ。大きな赤いカードは、人数しか載せないのに場所をとっていた。
// 招待への入口は、招待の場所（S-32）の中では要らないので withInvite=false で隠す
export function GroupBand({ group, withInvite = true }: { group: GroupDetailResponse; withInvite?: boolean }) {
  const full = group.members.length >= GROUP_MEMBER_MAX;
  return (
    <section aria-label="グループ" className="fl-slab flex min-h-14 items-center gap-2.5 py-1.5 pr-1.5 pl-4">
      <Users aria-hidden className="size-5 shrink-0 text-brand" />
      <h2 className="min-w-0 flex-1 truncate text-base font-extrabold">{group.name}</h2>
      <p className="shrink-0 text-sm font-bold text-fg-muted">
        <span aria-label="いまの人数" className="fl-num text-xl text-fg">
          {group.members.length}
        </span>
        人／{GROUP_MEMBER_MAX}人まで
      </p>
      {withInvite && !full && (
        <Link
          href={withBack('/settings/group', 'friends')}
          className="flex min-h-11 shrink-0 items-center rounded-fl px-3 text-sm font-extrabold text-brand outline-none focus-visible:ring-4 focus-visible:ring-teal/40"
        >
          招待
        </Link>
      )}
    </section>
  );
}

// メンバーの一覧（参加した順）。自分には「あなた」を付ける
export function MemberList({ group }: { group: GroupDetailResponse }) {
  const { data: session } = useAppSession();
  const me = session?.user.id;

  return (
    <section>
      <h2 id="members-heading" className="flex items-center gap-1.5 pb-2 text-note font-bold tracking-widest text-fg-subtle">
        <Users aria-hidden className="size-4" />
        メンバー
      </h2>
      <ul aria-labelledby="members-heading" className="space-y-2">
        {group.members.map((m) => (
          <li key={m.id} className="fl-slab flex min-h-14 items-center gap-3 p-2.5">
            <Avatar avatar={m.avatar} size={44} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-extrabold">{m.name}</p>
              {m.bio && <p className="truncate text-sm text-fg-muted">{m.bio}</p>}
            </div>
            {m.id === me && <span className="fl-tag bg-gold text-fg">あなた</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}
