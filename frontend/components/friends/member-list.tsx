'use client';

import { Users } from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import type { GroupDetailResponse } from '@/lib/api/generated';

export const GROUP_MEMBER_MAX = 5;

// キャラの服の色から、名前の頭文字を置く丸の色を決める（白文字が読める濃い色に寄せる）
export const AVATAR_BG: Record<string, string> = {
  teal: '#0e7f83',
  navy: '#1e2a3a',
  coral: '#c23b2d',
  purple: '#6a57cf',
  gold: '#8a6200',
};

// グループの名前と、いまの人数（大きな数字）。仲間タブ（S-20）とグループの設定（S-32）で同じ見た目を使う
export function GroupSummary({ group }: { group: GroupDetailResponse }) {
  return (
    <section className="fl-stripes relative overflow-hidden rounded-fl bg-coral px-[18px] pt-3.5 pb-4 text-ink shadow-[0_4px_0_var(--color-coral-dark)]">
      <span className="fl-tag bg-gold text-ink">TEAM</span>
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

// メンバーの一覧（参加した順）。自分には「あなた」を付ける
export function MemberList({ group }: { group: GroupDetailResponse }) {
  const { data: session } = authClient.useSession();
  const me = session?.user.id;

  return (
    <section>
      <h2 id="members-heading" className="flex items-center gap-1.5 pb-2 text-xs font-bold tracking-widest text-sub">
        <Users aria-hidden className="size-4" />
        メンバー
      </h2>
      <ul aria-labelledby="members-heading" className="space-y-2">
        {group.members.map((m) => (
          <li key={m.id} className="fl-slab flex min-h-14 items-center gap-3 p-2.5">
            <span
              aria-hidden
              className="flex size-11 shrink-0 items-center justify-center rounded-full text-[19px] font-extrabold text-white"
              style={{ background: AVATAR_BG[m.avatar.shirtColor] ?? AVATAR_BG.navy }}
            >
              {Array.from(m.name)[0]}
            </span>
            <span className="min-w-0 flex-1 truncate text-base font-extrabold">{m.name}</span>
            {m.id === me && <span className="fl-tag bg-gold text-ink">あなた</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}
