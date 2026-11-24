'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Fragment, useEffect, useRef, useState } from 'react';
import { ThickButton } from '@/components/fitlog/thick-button';
import { getGetFeedUnreadQueryKey, markFeedSeen, useGetFeed, type FeedTotals } from '@/lib/api/generated';
import { describeTotals, weekDividerLabel } from '@/lib/feed';
import { FEED_MESSAGES } from '@/lib/messages';
import { toLocalDate } from '@/lib/shared/local-date';
import { FeedCard } from './feed-card';
import { EmptyState } from '@/components/fitlog/empty-state';

// 仲間の足跡（S-20。docs/screen-design.md 4章）。週の区切りはやめ、同じグループの全期間を新しい順に流す（D7-6・判断ログ 50）。
// 20件ずつ。下までスクロールすると、前の応答の nextCursor を渡して自動で続きを読む（自分タブの記録の一覧と同じ作り）。
// 自動で動かない環境（古いブラウザ・キーボード操作）のために「もっと見る」ボタンも残す。
// 今週の合計は上の帯に小さく出す。ページに関係なく週全体なので、最初のページの値を使う
// hideEmptyTotals: 自分1人で今週まだ記録が無いとき、「今週のグループ」の空の枠（0.0km など）を出さない（D7-5）
export function FeedSection({ hideEmptyTotals = false }: { hideEmptyTotals?: boolean }) {
  return <FeedPage cursor={undefined} isFirst hideEmptyTotals={hideEmptyTotals} />;
}

// prevDate: 前のページの最後の足跡の日付（週の区切りを、ページをまたいで入れるため）
function FeedPage({ cursor, isFirst = false, hideEmptyTotals = false, prevDate }: { cursor: string | undefined; isFirst?: boolean; hideEmptyTotals?: boolean; prevDate?: string }) {
  const { data, isPending, isError } = useGetFeed(cursor ? { cursor } : {});
  const [more, setMore] = useState(false);
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
  const { items, nextCursor, totals } = data.data;
  const today = toLocalDate(new Date());
  return (
    <>
      {isFirst && !(hideEmptyTotals && describeTotals(totals).empty) && <WeekTotals totals={totals} />}
      {isFirst && items.length === 0 && (
        <EmptyState title={FEED_MESSAGES.empty} pose="cheer" />
      )}
      {items.length > 0 && (
        <ul aria-label="仲間の足跡" className="space-y-2">
          {items.map((item, i) => {
            const label = weekDividerLabel(i === 0 ? prevDate : items[i - 1]!.localDate, item.localDate, today);
            return (
              <Fragment key={item.id}>
                {label && <WeekDivider label={label} />}
                <FeedCard item={item} />
              </Fragment>
            );
          })}
        </ul>
      )}
      {nextCursor &&
        (more ? (
          <FeedPage cursor={nextCursor} prevDate={items.at(-1)?.localDate ?? prevDate} />
        ) : (
          <>
            <ThickButton tone="white" size="sm" className="w-full" onClick={() => setMore(true)}>
              {FEED_MESSAGES.loadMore}
            </ThickButton>
            <ScrollSentinel onReach={() => setMore(true)} />
          </>
        ))}
    </>
  );
}

// 週が変わるところの小さな区切り（「先週」など）。リストの中の見出しとして読み上げる
function WeekDivider({ label }: { label: string }) {
  return (
    <li role="separator" aria-label={label} className="flex items-center gap-2 pt-2 text-note font-extrabold text-fg-muted">
      <span aria-hidden className="h-0.5 flex-1 rounded-full bg-line" />
      <span aria-hidden>{label}</span>
      <span aria-hidden className="h-0.5 flex-1 rounded-full bg-line" />
    </li>
  );
}

// 画面の下に近づいたら続きを読む合図（IntersectionObserver）。使えない環境では何もしない（ボタンで読める）
function ScrollSentinel({ onReach }: { onReach: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) onReach();
      },
      { rootMargin: '300px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [onReach]);
  return <div ref={ref} aria-hidden data-testid="feed-sentinel" className="h-px" />;
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

// 今週のグループ合計。上の帯に小さく出す（D7-6）。順位・連続日数は出さない。だれも記録していない週は数字ではなく一言
function WeekTotals({ totals }: { totals: FeedTotals }) {
  const view = describeTotals(totals);
  return (
    <section aria-labelledby="week-totals-heading" className="fl-slab px-4 py-2">
      <h2 id="week-totals-heading" className="text-note font-extrabold text-fg-muted">
        {FEED_MESSAGES.weekHeading}
      </h2>
      {view.empty ? (
        <p className="text-sm font-bold">{FEED_MESSAGES.totalsEmpty}</p>
      ) : (
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5">
          <p className="text-sm font-extrabold">{view.recorded}</p>
          <dl className="flex flex-wrap gap-x-4 gap-y-0.5 text-note font-bold">
            <div className="flex items-baseline gap-1">
              <dt className="text-fg-muted">{FEED_MESSAGES.volumeLabel}</dt>
              <dd className="fl-num text-sm">{view.volume}</dd>
            </div>
            <div className="flex items-baseline gap-1">
              <dt className="text-fg-muted">{FEED_MESSAGES.distanceLabel}</dt>
              <dd className="fl-num text-sm">{view.distance}</dd>
            </div>
          </dl>
        </div>
      )}
    </section>
  );
}
