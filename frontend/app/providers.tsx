'use client';

import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider, type Persister } from '@tanstack/react-query-persist-client';
import { useState, type ReactNode } from 'react';
import { QueueOwner } from '@/components/fitlog/queue-owner';
import { registerRecordMutations } from '@/lib/mutations';
import { createQueuePersister, queueDehydrateOptions, QUEUE_MAX_AGE_MS } from '@/lib/offline/persister';
import { markQueueRestored } from '@/lib/offline/resume';

// 画面全体を包む入れ物。TanStack Query の QueryClient をここで1つ作り、
// 送信待ち（まだ API に届いていない書き込み）を IndexedDB に保存・復元する（F-30。docs/tech-stack.md）。
// persister は、テストで保存先を差し替えるために引数にできる（ふだんは IndexedDB）
export function Providers({ children, persister }: { children: ReactNode; persister?: Persister }) {
  // useState の初期化関数で作る: 再描画のたびに作り直さないため
  const [state] = useState(() => {
    const client = new QueryClient({
      defaultOptions: {
        // 30秒は「新鮮」とみなして、画面を開き直しても取り直さない（通信を減らす）
        queries: { staleTime: 30_000 },
      },
    });
    // 保存した送信待ちを戻すと、送信処理（mutationFn）は保存されていないので、先に登録しておく。
    // 利用者ごとの scope は、ログインしている人が分かった時点で登録し直す（useRecordMutations）
    registerRecordMutations(client, 'anonymous');
    return { client, persister: persister ?? createQueuePersister(), dehydrateOptions: queueDehydrateOptions(client) };
  });
  return (
    <PersistQueryClientProvider
      client={state.client}
      persistOptions={{ persister: state.persister, maxAge: QUEUE_MAX_AGE_MS, dehydrateOptions: state.dehydrateOptions }}
      onSuccess={() => markQueueRestored(state.client)}
    >
      <QueueOwner />
      {children}
    </PersistQueryClientProvider>
  );
}
