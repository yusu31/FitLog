import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AppShell } from '@/components/fitlog/app-shell';
import { MeFrame } from '@/components/me/me-frame';
import { StatsPage } from '@/components/me/stats-view';

export const metadata: Metadata = { title: 'レポート' };

// S-30 自分 > レポート（旧「記録のまとめ」S-35）。?metric=m（日本地図で見る）を useSearchParams で読むので、静的書き出しでは Suspense で包む
export default function MePage() {
  return (
    <AppShell>
      <MeFrame>
        <Suspense>
          <StatsPage />
        </Suspense>
      </MeFrame>
    </AppShell>
  );
}
