import type { Metadata } from 'next';
import { StatsPage } from '@/components/me/stats-view';

export const metadata: Metadata = { title: '記録のまとめ' };

export default function MeStatsPage() {
  return <StatsPage />;
}
