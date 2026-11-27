'use client';

import { cn } from 'cn';
import { Avatar } from '@/components/fitlog/avatar';
import type { GroupDetailResponse } from '@/lib/api/generated';
import { TODAY_LABEL } from '@/components/friends/friends-text';
import { HOME_MESSAGES } from '@/lib/messages';

// ホームの一番上の「今日の記録」の帯（02-9 PR 7a）。
// 今日、運動か休みを記録した仲間の顔を並べる。分母（何人中何人）は出さない。休みは紫のふち（休みも記録）。
// 自分はまだのあいだ点線のふちで入れる（自分が記録しないと金色にならない）。全員そろったら金色
export function TodayBand({ group, meId }: { group: GroupDetailResponse; meId: string | undefined }) {
  const members = group.members;
  if (members.length < 2) return null;
  const complete = members.every((m) => (m.today ?? 'none') !== 'none');
  const shown = members.filter((m) => (m.today ?? 'none') !== 'none' || m.id === meId);
  return (
    <section
      aria-label={HOME_MESSAGES.todayBand}
      data-testid="today-band"
      data-complete={complete ? 'true' : 'false'}
      className={cn('fl-slab flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3', complete && 'border-gold bg-gold-light')}
    >
      <h2 className="text-sm font-extrabold">{complete ? HOME_MESSAGES.todayBandComplete : HOME_MESSAGES.todayBand}</h2>
      <ul className="flex min-w-0 flex-wrap items-center gap-2">
        {shown.map((m) => {
          const today = m.today ?? 'none';
          const pending = today === 'none';
          return (
            <li
              key={m.id}
              data-testid="today-band-face"
              data-today={today}
              aria-label={`${m.name}：${pending ? HOME_MESSAGES.todayBandMePending : TODAY_LABEL[today]}`}
              className={cn(
                'rounded-full border-[3px] p-0.5',
                pending ? 'border-dashed border-line-dark' : today === 'rest' ? 'border-grape' : 'border-teal',
              )}
            >
              <Avatar avatar={m.avatar} size={36} />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
