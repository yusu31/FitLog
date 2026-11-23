import type { Metadata } from 'next';
import { AppShell } from '@/components/fitlog/app-shell';
import { StatsPage } from '@/components/me/stats-view';

export const metadata: Metadata = { title: '記録のまとめ' };

// 下のタブ「まとめ」の画面なので、ほかのタブと同じくタブ付きの枠に入れる（02-9 N1。全画面だとタブが消えて迷った）
export default function MeStatsPage() {
  return (
    <AppShell>
      <StatsPage />
    </AppShell>
  );
}
