import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PrivacyView } from '@/components/legal/legal-views';

export const metadata: Metadata = { title: 'プライバシーの扱い' };

export default function PrivacyPage() {
  // 戻り先を ?back= で受ける（useSearchParams）。静的書き出しでは Suspense で包む必要がある
  return (
    <Suspense>
      <PrivacyView />
    </Suspense>
  );
}
