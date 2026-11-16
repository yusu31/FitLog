import type { Metadata } from 'next';
import { Suspense } from 'react';
import { RunView } from '@/components/run/run-view';

export const metadata: Metadata = { title: 'ランを記録' };

// S-13 記録（ラン）（docs/screen-design.md）。タブの無い全画面
export default function RunPage() {
  // きのうの分（?day=yesterday）を受けるため useSearchParams を使う。静的書き出しでは Suspense で包む必要がある
  return (
    <Suspense>
      <RunView />
    </Suspense>
  );
}
