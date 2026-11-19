'use client';

import { Check, Clock, KeyRound, WifiOff } from 'lucide-react';
import Link from 'next/link';
import { useState, useSyncExternalStore } from 'react';
import { getRejectedSends, subscribeRejectedSends } from '@/lib/offline/rejected';
import { SYNC_MESSAGES } from '@/lib/messages';
import { useSentNotice } from '@/lib/offline/sent-notice';
import { isWaiting, useQueueSummary } from '@/lib/offline/sync-status';
import { useOnline } from '@/lib/use-browser-state';

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
  // 「送ったよ」の控えは画面の外に持つ（画面を移っても消えない。lib/offline/sent-notice.ts）
  const { peak, notice: sent } = useSentNotice(summary.count, waiting, rejectedCount);
  const [dismissed, setDismissed] = useState(0);

  const showQueue = summary.count > 0 && (waiting || peak > 0);
  const showRejected = rejectedCount > dismissed;

  return (
    <div role="status" aria-live="polite" data-testid="sync-banner">
      {!online && <Bar tone="face" icon={<WifiOff aria-hidden className="size-5" />} title={SYNC_MESSAGES.offline} note={SYNC_MESSAGES.offlineNote} />}
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
        {note && <p className="text-note font-bold text-sub-strong">{note}</p>}
      </div>
      {children}
    </div>
  );
}
