'use client';

import { useQueryClient } from '@tanstack/react-query';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { resetSentNotice } from '@/lib/offline/sent-notice';
import { SyncBanner } from './sync-banner';
import { isBrowseQueryKey } from '@/lib/offline/persister';
import { useAppSession } from '@/lib/use-app-session';
import { setQueueOwner } from '@/lib/offline/resume';

// 送信待ちの帯を自分で持っている画面（AppShell の今日・仲間・自分・記録）。それ以外の画面には、ここから帯を重ねて出す（A11-1・A11-2）
const OWN_BANNER = /^\/(home|log|friends|record|me(\/posts|\/profile)?)\/?$/;

// ログインしている人が分かったら、端末に保存した送信待ちの再送を始める（lib/offline/resume.ts）。
// どの画面から開き直しても再送が始まるよう、画面全体の入れ物（Providers）の中に1つ置く。帯の無い画面だけ、上に帯を重ねる。
// もう1つの役目（S4）: ログアウト・退会・別の人への切り替えで、端末に残した閲覧キャッシュを消す
// （次にログインした人に、前の人の記録を見せないため。機密性）
export function QueueOwner() {
  const client = useQueryClient();
  const pathname = usePathname() ?? '';
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
    if (changed) resetSentNotice(); // 前の人の分の「送ったよ」を次の人に見せない
    if (changed) client.removeQueries({ predicate: (q) => isBrowseQueryKey(q.queryKey) });
  }, [client, userId, isPending]);
  // 記録・詳細など、帯の無い画面でも「電波なし」「送信待ち」「送ったよ」を上に重ねる（画面を移っても「送ったよ」が消えないよう、控えは lib/offline/sent-notice.ts）
  if (!userId || OWN_BANNER.test(pathname)) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-40 mx-auto max-w-[430px]">
      <SyncBanner />
    </div>
  );
}
