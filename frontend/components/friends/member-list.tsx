'use client';

import { Users } from 'lucide-react';
import Link from 'next/link';
import { Avatar, AVATAR_BG } from '@/components/fitlog/avatar';
import { useAppSession } from '@/lib/use-app-session';
import type { GroupDetailResponse } from '@/lib/api/generated';

export const GROUP_MEMBER_MAX = 5;

// 丸の色の表は fitlog/avatar.tsx に移した（顔の丸 Avatar と同じ表を使う）。既存の import を壊さないため、ここからも出す
export { AVATAR_BG };

// グループの名前と、いまの人数（大きな数字）。仲間タブ（S-20）とグループの設定（S-32）で同じ見た目を使う
export function GroupSummary({ group }: { group: GroupDetailResponse }) {
  return (
    <section className="fl-stripes relative overflow-hidden rounded-fl bg-coral px-[18px] pt-3.5 pb-4 text-fg shadow-[0_4px_0_var(--color-coral-dark)]">
      <span className="fl-tag bg-gold text-fg">なかま</span>
      <p className="mt-3 flex items-baseline gap-1.5 leading-none">
        <span aria-label="いまの人数" className="fl-num text-7xl">
          {group.members.length}
        </span>
        <span className="text-xl font-extrabold">人</span>
        <span className="ml-1 text-sm font-bold">／ {GROUP_MEMBER_MAX}人まで</span>
      </p>
      <h2 className="mt-2 text-lg font-extrabold break-all">{group.name}</h2>
    </section>
  );
}

// 仲間タブ（S-20）の上の1行の帯（D7-4）。グループ名・人数・招待への入口だけ。大きな赤いカードは、人数しか載せないのに場所をとっていた
export function GroupBand({ group }: { group: GroupDetailResponse }) {
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
      {!full && (
        <Link
          href="/settings/group"
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
            <Avatar shirtColor={m.avatar.shirtColor} size={44} />
            <span className="min-w-0 flex-1 truncate text-base font-extrabold">{m.name}</span>
            {m.id === me && <span className="fl-tag bg-gold text-fg">あなた</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}
