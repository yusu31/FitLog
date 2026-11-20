'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { ThickButton } from '@/components/fitlog/thick-button';
import { getGetFeedUnreadQueryKey, markFeedSeen, useGetFeed, type FeedTotals } from '@/lib/api/generated';
import { describeTotals } from '@/lib/feed';
import { FEED_MESSAGES } from '@/lib/messages';
import { toLocalDate } from '@/lib/shared/local-date';
import { FeedCard } from './feed-card';
import { FRIENDS_TEXT } from './friends-text';

// 仲間の足跡（S-20。docs/screen-design.md 4章）。今週（日本時間の月曜〜日曜）のグループ合計と、新しい順の足跡。
// 20件ずつ。「もっと見る」で、前の応答の nextCursor を渡して続きを読む（自分タブの記録の一覧と同じ作り）。
// 合計はページに関係なく週全体なので、最初のページの値を使う
// hideEmptyTotals: 自分1人で今週まだ記録が無いとき、「今週のグループ」の空の枠（0.0km など）を出さない（D7-5）
export function FeedSection({ hideEmptyTotals = false }: { hideEmptyTotals?: boolean }) {
  const weekStart = toLocalDate(new Date());
  return <FeedPage weekStart={weekStart} cursor={undefined} isFirst hideEmptyTotals={hideEmptyTotals} />;
}

function FeedPage({
  weekStart,
  cursor,
  isFirst = false,
  hideEmptyTotals = false,
}: {
  weekStart: string;
  cursor: string | undefined;
  isFirst?: boolean;
  hideEmptyTotals?: boolean;
}) {
  const { data, isPending, isError } = useGetFeed({ weekStart, ...(cursor ? { cursor } : {}) });
  const [more, setMore] = useState(false);
  const [showOlder, setShowOlder] = useState(false);
  useMarkSeen(isFirst && !isPending && !isError && data?.status === 200);

  if (isPending) {
    return <div aria-busy="true" aria-label="足跡を読み込み中" className="h-40 animate-pulse rounded-fl bg-canvas" />;
  }
  if (isError || !data || data.status !== 200) {
    return (
      <p role="alert" className="rounded-fl bg-coral-light px-4 py-3 text-sm font-bold text-fg">
        {FEED_MESSAGES.loadFailed}
      </p>
    );
  }
  const { items: allItems, nextCursor, totals } = data.data;
  // 最初のページは「今日」の足跡だけ見せ、前の日の分と続きは1つのボタンの奥に置く（A04-13）
  const today = toLocalDate(new Date());
  const hideOlder = isFirst && !showOlder;
  const olderCount = isFirst ? allItems.filter((i) => i.localDate !== today).length : 0;
  const items = hideOlder ? allItems.filter((i) => i.localDate === today) : allItems;
  const holdBack = hideOlder && olderCount > 0;
  return (
    <>
      {isFirst && !(hideEmptyTotals && describeTotals(totals).empty) && <WeekTotals totals={totals} />}
      {isFirst && items.length === 0 && (
        <p className="fl-slab px-4 py-5 text-center text-sm font-bold text-fg-muted">{FEED_MESSAGES.empty}</p>
      )}
      {isFirst && allItems.length > 0 && items.length === 0 && (
        <p className="fl-slab px-4 py-5 text-center text-sm font-bold text-fg-muted">{FRIENDS_TEXT.todayEmpty}</p>
      )}
      {items.length > 0 && (
        <ul aria-label="仲間の足跡" className="space-y-2">
          {items.map((item) => (
            <FeedCard key={item.id} item={item} />
          ))}
        </ul>
      )}
      {holdBack && (
        <ThickButton tone="white" size="sm" className="w-full" onClick={() => setShowOlder(true)}>
          {FRIENDS_TEXT.showOlder(olderCount)}
        </ThickButton>
      )}
      {!holdBack &&
        nextCursor &&
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

// 新着の印（F4）。最初のページが読めたら「見た」を1回だけ送り、下のタブの点を消す。
// 送れなくても（電波なし等）足跡は見られるので、知らせない。次に開いたときにまた送る。
// 札（新着）は今読んだ足跡の値のまま残す（送ったあとに足跡を取り直さない。見ている最中に札が消えないように）
function useMarkSeen(ready: boolean) {
  const queryClient = useQueryClient();
  const sent = useRef(false);
  useEffect(() => {
    if (!ready || sent.current) return;
    sent.current = true;
    markFeedSeen()
      .then(() => queryClient.setQueryData(getGetFeedUnreadQueryKey(), { status: 200, data: { hasNew: false }, headers: new Headers() }))
      .catch(() => undefined);
  }, [ready, queryClient]);
}

// 今週のグループ合計。順位・連続日数は出さない。だれも記録していない週は数字ではなく一言
function WeekTotals({ totals }: { totals: FeedTotals }) {
  const view = describeTotals(totals);
  return (
    <section aria-labelledby="week-totals-heading" className="fl-slab px-4 py-3">
      <h2 id="week-totals-heading" className="text-sm font-extrabold text-fg-muted">
        {FEED_MESSAGES.weekHeading}
      </h2>
      {view.empty ? (
        <p className="mt-1 text-sm font-bold">{FEED_MESSAGES.totalsEmpty}</p>
      ) : (
        <>
          <p className="mt-0.5 text-lg font-extrabold">{view.recorded}</p>
          <dl className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-sm font-bold">
            <div className="flex items-baseline gap-1.5">
              <dt className="text-fg-muted">{FEED_MESSAGES.volumeLabel}</dt>
              <dd className="fl-num text-lg">{view.volume}</dd>
            </div>
            <div className="flex items-baseline gap-1.5">
              <dt className="text-fg-muted">{FEED_MESSAGES.distanceLabel}</dt>
              <dd className="fl-num text-lg">{view.distance}</dd>
            </div>
          </dl>
        </>
      )}
    </section>
  );
}
