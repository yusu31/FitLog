'use client';

import { useState } from 'react';
import { ThickButton } from '@/components/fitlog/thick-button';
import { useGetFeed, type FeedTotals } from '@/lib/api/generated';
import { describeTotals } from '@/lib/feed';
import { FEED_MESSAGES } from '@/lib/messages';
import { toLocalDate } from '@/lib/shared/local-date';
import { FeedCard } from './feed-card';

// 仲間の足跡（S-20。docs/screen-design.md 4章）。今週（日本時間の月曜〜日曜）のグループ合計と、新しい順の足跡。
// 20件ずつ。「もっと見る」で、前の応答の nextCursor を渡して続きを読む（自分タブの記録の一覧と同じ作り）。
// 合計はページに関係なく週全体なので、最初のページの値を使う
export function FeedSection() {
  const weekStart = toLocalDate(new Date());
  return <FeedPage weekStart={weekStart} cursor={undefined} isFirst />;
}

function FeedPage({ weekStart, cursor, isFirst = false }: { weekStart: string; cursor: string | undefined; isFirst?: boolean }) {
  const { data, isPending, isError } = useGetFeed({ weekStart, ...(cursor ? { cursor } : {}) });
  const [more, setMore] = useState(false);

  if (isPending) {
    return <div aria-busy="true" aria-label="足跡を読み込み中" className="h-40 animate-pulse rounded-fl bg-face" />;
  }
  if (isError || !data || data.status !== 200) {
    return (
      <p role="alert" className="rounded-fl bg-coral-light px-4 py-3 text-sm font-bold text-ink">
        {FEED_MESSAGES.loadFailed}
      </p>
    );
  }
  const { items, nextCursor, totals } = data.data;
  return (
    <>
      {isFirst && <WeekTotals totals={totals} />}
      {isFirst && items.length === 0 && (
        <p className="fl-slab px-4 py-5 text-center text-sm font-bold text-sub-strong">{FEED_MESSAGES.empty}</p>
      )}
      {items.length > 0 && (
        <ul aria-label="仲間の足跡" className="space-y-2">
          {items.map((item) => (
            <FeedCard key={item.id} item={item} />
          ))}
        </ul>
      )}
      {nextCursor &&
        (more ? (
          <FeedPage weekStart={weekStart} cursor={nextCursor} />
        ) : (
          <ThickButton tone="white" size="sm" className="w-full" onClick={() => setMore(true)}>
            {FEED_MESSAGES.loadMore}
          </ThickButton>
        ))}
    </>
  );
}

// 今週のグループ合計。順位・連続日数は出さない。だれも記録していない週は数字ではなく一言
function WeekTotals({ totals }: { totals: FeedTotals }) {
  const view = describeTotals(totals);
  return (
    <section aria-labelledby="week-totals-heading" className="fl-slab px-4 py-3">
      <h2 id="week-totals-heading" className="text-sm font-extrabold text-sub-strong">
        {FEED_MESSAGES.weekHeading}
      </h2>
      {view.empty ? (
        <p className="mt-1 text-sm font-bold">{FEED_MESSAGES.totalsEmpty}</p>
      ) : (
        <>
          <p className="mt-0.5 text-lg font-extrabold">{view.recorded}</p>
          <dl className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-sm font-bold">
            <div className="flex items-baseline gap-1.5">
              <dt className="text-sub-strong">{FEED_MESSAGES.volumeLabel}</dt>
              <dd className="fl-num text-lg">{view.volume}</dd>
            </div>
            <div className="flex items-baseline gap-1.5">
              <dt className="text-sub-strong">{FEED_MESSAGES.distanceLabel}</dt>
              <dd className="fl-num text-lg">{view.distance}</dd>
            </div>
          </dl>
        </>
      )}
    </section>
  );
}
