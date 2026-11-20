'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ThickButton } from '@/components/fitlog/thick-button';
import { useGetMyVideos } from '@/lib/api/generated';
import { formatMonthDay } from '@/lib/format';
import { VIDEO_GRID_MESSAGES } from './messages';
import { VideoGrid } from './video-grid';

// 「自分」タブの過去の2秒動画のグリッド（台帳 A04-10・A14-2）。自分の分は閲覧条件なし。
// 「もっと見る」で、前の応答の nextCursor を渡して続きを読む（記録の一覧と同じ作り）。選ぶと、その動画の記録の詳細へ
export function MyVideoGrid() {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-extrabold">{VIDEO_GRID_MESSAGES.gridLabel}</h2>
      <Page cursor={undefined} isFirst />
    </section>
  );
}

function Page({ cursor, isFirst = false }: { cursor: string | undefined; isFirst?: boolean }) {
  const router = useRouter();
  const [more, setMore] = useState(false);
  const { data, isPending, isError } = useGetMyVideos(cursor ? { cursor } : undefined);

  if (isPending) return <div aria-busy="true" aria-label={VIDEO_GRID_MESSAGES.loading} className="h-32 animate-pulse rounded-fl bg-canvas" />;
  if (isError || !data || data.status !== 200) {
    return (
      <p role="alert" className="rounded-fl bg-coral-light px-4 py-3 text-sm font-bold text-fg">
        {VIDEO_GRID_MESSAGES.loadFailed}
      </p>
    );
  }
  const { items, nextCursor } = data.data;
  if (!isFirst && items.length === 0) return null;
  const recordOf = (id: string) => items.find((v) => v.id === id)?.recordId;
  return (
    <>
      <VideoGrid
        items={items.map((v) => ({ id: v.id, label: formatMonthDay(v.localDate), mine: true }))}
        layout="grid"
        onSelect={(id) => {
          const rid = recordOf(id);
          if (rid) router.push(`/record-detail?id=${encodeURIComponent(rid)}&from=me`);
        }}
      />
      {nextCursor &&
        (more ? (
          <Page cursor={nextCursor} />
        ) : (
          <ThickButton tone="white" size="sm" className="w-full" onClick={() => setMore(true)}>
            {VIDEO_GRID_MESSAGES.loadMore}
          </ThickButton>
        ))}
    </>
  );
}
