import type { Metadata } from 'next';
import { Suspense } from 'react';
import { TermsView } from '@/components/legal/legal-views';

export const metadata: Metadata = { title: '利用規約' };

export default function TermsPage() {
  // 戻り先を ?back= で受ける（useSearchParams）。静的書き出しでは Suspense で包む必要がある
  return (
    <Suspense>
      <TermsView />
    </Suspense>
  );
}
