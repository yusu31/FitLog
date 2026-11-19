'use client';

import { UserPlus, Users } from 'lucide-react';
import Link from 'next/link';
import { useGetCurrentGroup, useGetFeed, type FeedItem } from '@/lib/api/generated';
import { TODAY_FRIENDS_MESSAGES } from '@/lib/messages';
import { useAppSession } from '@/lib/use-app-session';

const FOCUS = 'outline-none focus-visible:ring-4 focus-visible:ring-teal/40';
const NAMES_MAX = 3;

// 仲間の今日の足跡を、人ごとに1回だけ数える（自分は除く）。同じ人に記録とおやすみがあれば記録を優先する
export function summarizeFriendsToday(
  items: readonly Pick<FeedItem, 'kind' | 'localDate' | 'author'>[],
  selfId: string | undefined,
  today: string,
): { recorded: string[]; rested: string[] } {
  const recorded = new Map<string, string>();
  const rested = new Map<string, string>();
  for (const it of items) {
    if (it.localDate !== today || it.author.id === selfId) continue;
    (it.kind === 'rest' ? rested : recorded).set(it.author.id, it.author.name);
  }
  for (const id of recorded.keys()) rested.delete(id);
  return { recorded: [...recorded.values()], rested: [...rested.values()] };
}

const joinNames = (names: string[]): string =>
  names.length <= NAMES_MAX ? names.join('・') : `${names.slice(0, NAMES_MAX).join('・')} ほか${names.length - NAMES_MAX}人`;

// 今日画面の上の「仲間の今日の足跡」1行（A02-1）と、グループが無い・自分だけのときの招待の入口（A01-8）。
// 仲間タブと同じフィード（GET /feed）を使う。足跡の最初の20件だけを見る。取れなかったときは何も出さない
export function FriendsToday({ today }: { today: string }) {
  const group = useGetCurrentGroup();
  const { data: session } = useAppSession();
  const members = group.data?.status === 200 ? group.data.data.members.length : 0;
  const feed = useGetFeed({ weekStart: today }, { query: { enabled: members >= 2 } });

  if (group.isPending || group.isError || !group.data) return null;
  if (group.data.status === 404) return <InviteCard noGroup />;
  if (group.data.status !== 200) return null;
  if (members <= 1) return <InviteCard noGroup={false} />;

  const items = feed.data?.status === 200 ? feed.data.data.items : null;
  if (!items) return null;
  const { recorded, rested } = summarizeFriendsToday(items, session?.user.id, today);
  const parts = [
    recorded.length > 0 ? TODAY_FRIENDS_MESSAGES.recorded(joinNames(recorded)) : null,
    rested.length > 0 ? TODAY_FRIENDS_MESSAGES.rested(joinNames(rested)) : null,
  ].filter((p): p is string => p !== null);

  return (
    <Link
      href="/friends"
      aria-label={`${TODAY_FRIENDS_MESSAGES.label} ${parts.length > 0 ? parts.join('　') : TODAY_FRIENDS_MESSAGES.none}`}
      className={`flex min-h-12 items-center gap-2 rounded-fl bg-teal-light px-4 py-2 text-sm font-extrabold text-ink ${FOCUS}`}
    >
      <Users aria-hidden className="size-5 shrink-0 text-teal-dark" />
      <span aria-hidden className="min-w-0">
        <span className="text-teal-deep">{TODAY_FRIENDS_MESSAGES.label}</span>
        <span className="ml-2">{parts.length > 0 ? parts.join('　') : TODAY_FRIENDS_MESSAGES.none}</span>
      </span>
    </Link>
  );
}

function InviteCard({ noGroup }: { noGroup: boolean }) {
  return (
    <section aria-label="仲間" className="fl-slab px-4 py-3">
      <p className="text-sm font-extrabold">{noGroup ? TODAY_FRIENDS_MESSAGES.noGroupTitle : TODAY_FRIENDS_MESSAGES.aloneTitle}</p>
      <p className="mt-1 text-note leading-relaxed font-bold text-sub-strong">{noGroup ? TODAY_FRIENDS_MESSAGES.noGroupSteps : TODAY_FRIENDS_MESSAGES.aloneSteps}</p>
      <Link
        href="/friends"
        className={`fl-thick mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-fl bg-teal-dark px-4 text-base font-extrabold text-white [--thick:var(--color-teal-deep)] ${FOCUS}`}
      >
        <UserPlus aria-hidden className="size-5" />
        {TODAY_FRIENDS_MESSAGES.invite}
      </Link>
    </section>
  );
}
