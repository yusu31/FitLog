import type { GroupEventResponse } from './groups.response.js';

// タイムラインの上に出す出来事（PR 7b）。専用の表は持たず、参加した時刻（group_members.joined_at）と、
// ミッションを最後に直した時刻（groups.mission_changed_at）から、その場で組み立てる。
// ・直近 EVENT_DAYS 日だけ・新しい順・最大 EVENT_MAX 件
// ・グループを作った人の「加わった」は出さない（作った時刻と同じで、出来事ではない）
export const EVENT_DAYS = 14;
export const EVENT_MAX = 5;

type Input = {
  now: Date;
  createdBy: string | null;
  members: { id: string; name: string; joinedAt: Date }[];
  mission: { at: Date; by: { id: string; name: string } | null } | null;
};

export function buildGroupEvents({ now, createdBy, members, mission }: Input): GroupEventResponse[] {
  const since = now.getTime() - EVENT_DAYS * 24 * 60 * 60 * 1000;
  const events: GroupEventResponse[] = members
    .filter((m) => m.id !== createdBy && m.joinedAt.getTime() > since)
    .map((m) => ({ kind: 'joined' as const, at: m.joinedAt, actorId: m.id, actorName: m.name }));
  if (mission && mission.at.getTime() > since) {
    events.push({ kind: 'mission', at: mission.at, actorId: mission.by?.id ?? null, actorName: mission.by?.name ?? null });
  }
  return events.sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, EVENT_MAX);
}
