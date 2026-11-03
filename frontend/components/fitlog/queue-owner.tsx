'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { authClient } from '@/lib/auth-client';
import { setQueueOwner } from '@/lib/offline/resume';

// ログインしている人が分かったら、端末に保存した送信待ちの再送を始める（lib/offline/resume.ts）。
// どの画面から開き直しても再送が始まるよう、画面全体の入れ物（Providers）の中に1つ置く。何も描かない
export function QueueOwner() {
  const client = useQueryClient();
  const { data: session } = authClient.useSession();
  const userId = session?.user?.id;
  useEffect(() => {
    if (userId) setQueueOwner(client, userId);
  }, [client, userId]);
  return null;
}
