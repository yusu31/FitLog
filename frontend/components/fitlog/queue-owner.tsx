'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { isBrowseQueryKey } from '@/lib/offline/persister';
import { useAppSession } from '@/lib/use-app-session';
import { setQueueOwner } from '@/lib/offline/resume';

// ログインしている人が分かったら、端末に保存した送信待ちの再送を始める（lib/offline/resume.ts）。
// どの画面から開き直しても再送が始まるよう、画面全体の入れ物（Providers）の中に1つ置く。何も描かない。
// もう1つの役目（S4）: ログアウト・退会・別の人への切り替えで、端末に残した閲覧キャッシュを消す
// （次にログインした人に、前の人の記録を見せないため。機密性）
export function QueueOwner() {
  const client = useQueryClient();
  const { data: session, isPending } = useAppSession();
  // 確認中は控えの人で画面が開くが、再送は確認が済んでから（別の人の記録を送らないため）
  const userId = isPending ? undefined : session?.user?.id;
  const lastUserId = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (userId) setQueueOwner(client, userId);
  }, [client, userId]);
  useEffect(() => {
    if (isPending) return;
    const changed = lastUserId.current !== undefined && lastUserId.current !== userId; // ログアウト（undefined）も含む
    lastUserId.current = userId;
    if (changed) client.removeQueries({ predicate: (q) => isBrowseQueryKey(q.queryKey) });
  }, [client, userId, isPending]);
  return null;
}
