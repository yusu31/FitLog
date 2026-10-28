'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

// 画面全体を包む入れ物。TanStack Query の QueryClient をここで1つ作る。
// 送信待ちの保存・再送（F-30）の設定は、記録の書き込みができる 02-2 以降で足す（docs/tech-stack.md）。
export function Providers({ children }: { children: ReactNode }) {
  // useState の初期化関数で作る: 再描画のたびに作り直さないため
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          // 30秒は「新鮮」とみなして、画面を開き直しても取り直さない（通信を減らす）
          queries: { staleTime: 30_000 },
        },
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
