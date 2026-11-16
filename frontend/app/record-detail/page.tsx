import type { Metadata } from 'next';
import { Suspense } from 'react';
import { RecordDetailView } from '@/components/record-detail/record-detail-view';

export const metadata: Metadata = { title: '記録の詳細' };

// 記録の ID はクエリ（?id=）で受ける。静的書き出しでは useSearchParams を Suspense で包む必要がある
export default function RecordDetailPage() {
  return (
    <Suspense>
      <RecordDetailView />
    </Suspense>
  );
}
