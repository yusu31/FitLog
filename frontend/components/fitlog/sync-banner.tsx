'use client';

import { Check, Clock, KeyRound } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { getRejectedSends, subscribeRejectedSends } from '@/lib/offline/rejected';
import { SYNC_MESSAGES } from '@/lib/messages';
import { isWaiting, useQueueSummary } from '@/lib/offline/sync-status';
import { useOnline } from '@/lib/use-browser-state';

export const SENT_VISIBLE_MS = 3000;

// ログイン後に戻る先（いま開いている画面）。帯が出るのは画面を開いたあとなので、ブラウザの位置をそのまま読む
const currentPath = (): string => (typeof window === 'undefined' ? '/today' : window.location.pathname + window.location.search);

// 送信待ちの帯（screen-design.md「送信待ちの表示（F-30）」）。ふだんは何も出さない。
// 送信待ちがあるとき「送信待ち N件」、全部送れたら 3秒だけ「N件 送ったよ」、401 のときは「ログイン」ボタンつき。
// 色だけで区別せず、アイコンと文言を添える。読み上げ用の領域（role=status）は常に置き、中身だけ出し入れする
export function SyncBanner() {
  const summary = useQueueSummary();
  const online = useOnline();
  const rejectedCount = useSyncExternalStore(subscribeRejectedSends, () => getRejectedSends().length, () => 0);

  const waiting = isWaiting(summary, online);
  // 一度帯を出したら、全部送れるまで出し続ける（送っている途中で消えて、また出るのを避ける）。
  // peak=帯を出している間の最大件数、base=そのとき外されていた件数、sent=「送ったよ」に出す件数（seq は出すたびに増やす）
  const [track, setTrack] = useState<{ peak: number; base: number; sent: { n: number; seq: number } | null }>({ peak: 0, base: 0, sent: null });
  const [dismissed, setDismissed] = useState(0);

  // 外部の状態（送信待ちの件数）に合わせて、描画の中で状態を進める（React の公式の書き方。effect で setState しない）
  let next = track;
  if (summary.count > 0 && (waiting || track.peak > 0)) {
    if (summary.count > track.peak) next = { peak: summary.count, base: track.peak === 0 ? rejectedCount : track.base, sent: null };
  } else if (summary.count === 0 && track.peak > 0) {
    // 外された（送れなかった）分は「送ったよ」に数えない
    const delivered = track.peak - (rejectedCount - track.base);
    next = { peak: 0, base: 0, sent: delivered > 0 ? { n: delivered, seq: (track.sent?.seq ?? 0) + 1 } : null };
  }
  if (next !== track) setTrack(next);
  const sent = track.sent;
  const peak = track.peak;

  const seq = sent?.seq;
  useEffect(() => {
    if (seq === undefined) return;
    const timer = setTimeout(() => setTrack((t) => (t.sent?.seq === seq ? { ...t, sent: null } : t)), SENT_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [seq]);

  const showQueue = summary.count > 0 && (waiting || peak > 0);
  const showRejected = rejectedCount > dismissed;

  return (
    <div role="status" aria-live="polite" data-testid="sync-banner">
      {showQueue && summary.authExpired ? (
        <Bar tone="coral" icon={<KeyRound aria-hidden className="size-5" />} title={SYNC_MESSAGES.pending(summary.count)} note={SYNC_MESSAGES.authNote}>
          <Link
            href={`/login?next=${encodeURIComponent(currentPath())}`}
            className="inline-flex min-h-11 items-center rounded-fl bg-ink px-4 text-sm font-extrabold text-white outline-none focus-visible:ring-4 focus-visible:ring-teal/40"
          >
            {SYNC_MESSAGES.login}
          </Link>
        </Bar>
      ) : showQueue ? (
        <Bar
          tone="face"
          icon={<Clock aria-hidden className="size-5" />}
          title={SYNC_MESSAGES.pending(summary.count)}
          note={online ? SYNC_MESSAGES.retryNote : SYNC_MESSAGES.savedNote}
        />
      ) : sent && summary.count === 0 ? (
        <Bar tone="teal" icon={<Check aria-hidden className="size-5" strokeWidth={3} />} title={SYNC_MESSAGES.sent(sent.n)} />
      ) : null}
      {showRejected && (
        <Bar tone="coral" title={SYNC_MESSAGES.rejected} note={SYNC_MESSAGES.rejectedNote}>
          <button
            type="button"
            onClick={() => setDismissed(rejectedCount)}
            className="inline-flex min-h-11 items-center rounded-fl bg-white px-4 text-sm font-extrabold text-ink outline-none focus-visible:ring-4 focus-visible:ring-teal/40"
          >
            {SYNC_MESSAGES.dismiss}
          </button>
        </Bar>
      )}
    </div>
  );
}

const TONE = { face: 'bg-face', teal: 'bg-teal-light', coral: 'bg-coral-light' } as const;

function Bar({
  tone,
  icon,
  title,
  note,
  children,
}: {
  tone: keyof typeof TONE;
  icon?: React.ReactNode;
  title: string;
  note?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 text-ink ${TONE[tone]}`}>
      {icon && <span className="shrink-0">{icon}</span>}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-extrabold">{title}</p>
        {note && <p className="text-xs font-bold text-sub-strong">{note}</p>}
      </div>
      {children}
    </div>
  );
}
