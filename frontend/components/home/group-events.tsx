'use client';

import { Flag, UserPlus } from 'lucide-react';
import type { GroupEventResponse } from '@/lib/api/generated';

// タイムラインの上の出来事の1行（02-9 PR 7b）。仲間が加わった・ミッションを直した（直近14日・新しい順・最大5件。API が絞って返す）。
// 自分のことは「あなた」と書く。退会した人は「だれか」。events が無い（古い応答）ときは何も出さない
export function groupEventText(e: Pick<GroupEventResponse, 'kind' | 'actorId' | 'actorName'>, meId: string | undefined): string {
  const who = e.actorId && e.actorId === meId ? 'あなた' : e.actorName ? `${e.actorName}さん` : 'だれか';
  return e.kind === 'joined' ? `${who}が仲間に加わりました` : `${who}がミッションを変えました`;
}

const dayOf = (at: string) => {
  const d = new Date(at);
  return `${d.getMonth() + 1}/${d.getDate()}`;
};

export function GroupEvents({ events, meId }: { events: GroupEventResponse[] | undefined; meId: string | undefined }) {
  if (!events || events.length === 0) return null;
  return (
    <ul aria-label="グループの出来事" data-testid="group-events" className="space-y-1.5">
      {events.map((e) => {
        const Icon = e.kind === 'joined' ? UserPlus : Flag;
        return (
          <li key={`${e.kind}-${e.at}-${e.actorId ?? 'x'}`} className="flex items-center gap-2 rounded-fl bg-surface/70 px-3 py-1.5 text-sm font-bold text-fg-muted">
            <Icon aria-hidden className="size-4 shrink-0 text-brand" />
            <span className="min-w-0 flex-1 truncate">{groupEventText(e, meId)}</span>
            <time dateTime={e.at} className="shrink-0 text-note text-fg-subtle">
              {dayOf(e.at)}
            </time>
          </li>
        );
      })}
    </ul>
  );
}
