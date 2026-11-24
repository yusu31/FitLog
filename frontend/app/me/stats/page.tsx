import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AppShell } from '@/components/fitlog/app-shell';
import { StatsPage } from '@/components/me/stats-view';

export const metadata: Metadata = { title: '記録のまとめ' };

// ?metric=m（日本地図で見る）を useSearchParams で読むので、静的書き出しでは Suspense で包む
// 下のタブ「まとめ」の画面なので、ほかのタブと同じくタブ付きの枠に入れる（02-9 N1。全画面だとタブが消えて迷った）
export default function MeStatsPage() {
  return (
    <AppShell>
      <Suspense>
        <StatsPage />
      </Suspense>
    </AppShell>
  );
}
