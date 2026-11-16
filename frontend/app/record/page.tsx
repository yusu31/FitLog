import type { Metadata } from 'next';
import { Suspense } from 'react';
import { RecordView } from '@/components/record/record-view';

export const metadata: Metadata = { title: '筋トレを記録' };

// 種目の ID はクエリ（?exercise=）で受ける。静的書き出しでは useSearchParams を Suspense で包む必要がある
export default function RecordPage() {
  return (
    <Suspense>
      <RecordView />
    </Suspense>
  );
}
