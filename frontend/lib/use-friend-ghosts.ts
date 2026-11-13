import { useQueries } from '@tanstack/react-query';
import { getGetPreviousQueryOptions, useGetCurrentGroup } from '@/lib/api/generated';
import { friendGhostValue } from '@/lib/record-flow';
import { useAppSession } from '@/lib/use-app-session';
import type { SetValue } from '@/lib/shared/ghost';

export type FriendGhost = {
  id: string;
  name: string;
  shirtColor: string;
  // 読み込み中は undefined、前回が無ければ null
  value: SetValue | null | undefined;
};

// 同じグループの仲間（自分以外・最大4人）の、この種目の前回（F-16）。画面を開いたときに全員ぶん取り、
// 記録の無い仲間はボタンをグレーにする。仲間の自己ベストは API が返さない
export function useFriendGhosts(exerciseId: string, before: string, setNo: number, enabled: boolean): FriendGhost[] {
  const { data: session } = useAppSession();
  const { data: groupData } = useGetCurrentGroup({ query: { enabled } });
  const members = groupData?.status === 200 ? groupData.data.members.filter((m) => m.id !== session?.user.id) : [];

  const results = useQueries({
    queries: members.map((m) => ({
      ...getGetPreviousQueryOptions(exerciseId, { before, friendId: m.id }),
      enabled: enabled && exerciseId !== '',
    })),
  });

  return members.map((m, i) => {
    const r = results[i]?.data;
    const value = r === undefined ? (results[i]?.isError ? null : undefined) : r.status === 200 ? friendGhostValue(r.data.previous?.sets, setNo) : null;
    return { id: m.id, name: m.name, shirtColor: m.avatar.shirtColor, value };
  });
}
