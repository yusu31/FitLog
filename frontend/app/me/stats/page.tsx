import type { Metadata } from 'next';
import { LegacyRedirect } from '@/components/fitlog/legacy-redirect';

// 旧「記録のまとめ」。レポートは「自分」（/me）の先頭に移した（02-9 ⑫）。古い URL は新しい場所へ転送する
export const metadata: Metadata = { title: '記録のまとめ' };

export default function MeStatsPage() {
  return <LegacyRedirect to="/me" />;
}
