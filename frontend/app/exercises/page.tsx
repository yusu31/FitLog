import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ExercisesView } from '@/components/exercises/exercises-view';

export const metadata: Metadata = { title: '種目を選ぶ' };

export default function ExercisesPage() {
  // きのうの分（?day=yesterday）を引き継ぐため useSearchParams を使う。静的書き出しでは Suspense で包む必要がある
  return (
    <Suspense>
      <ExercisesView />
    </Suspense>
  );
}
