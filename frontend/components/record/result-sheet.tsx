'use client';

import { useEffect } from 'react';
import { cn } from 'cn';
import { GHOST_MESSAGES, RECORD_MESSAGES, ghostUpMessage } from '@/lib/messages';
import { usePrefersReducedMotion } from '@/lib/use-browser-state';
import type { GhostResult } from '@/lib/shared/ghost';

export const SHEET_MS = 800;

export type SheetData = {
  setId: string;
  result: GhostResult | null;
  diff: number;
  isPersonalBest: boolean;
  summary: string;
};

// 結果シート（features.md 2.6）。「できた」の直後に 0.8秒出し、タップで飛ばせる。
// 動きを減らす設定のときは、動かさず表示だけにする。責める言葉・悪い色は使わない（下回りも同じ明るい面）
export function ResultSheet({ sheet, onDismiss }: { sheet: SheetData | null; onDismiss: () => void }) {
  const reduced = usePrefersReducedMotion();
  const key = sheet?.setId;

  useEffect(() => {
    if (!key) return;
    const timer = setTimeout(onDismiss, SHEET_MS);
    return () => clearTimeout(timer);
    // 同じセットの結果が応答で直されても、0.8秒は数え直さない
  }, [key, onDismiss]);

  // 読み上げ用の領域は常に置き、中身だけ出し入れする（あとから挿入された領域は読まれないことがあるため）
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed bottom-0 left-1/2 z-20 w-full max-w-[430px] -translate-x-1/2">
      {sheet && <Body sheet={sheet} reduced={reduced} onDismiss={onDismiss} />}
    </div>
  );
}

function Body({ sheet, reduced, onDismiss }: { sheet: SheetData; reduced: boolean; onDismiss: () => void }) {
  const { result, diff, isPersonalBest, summary } = sheet;
  const gold = result === 'up' || isPersonalBest;
  const [upLabel, upAmount] = ghostUpMessage(diff).split(' ');
  return (
    <button
      type="button"
      data-testid="result-sheet"
      data-motion={reduced ? 'reduced' : 'full'}
      onClick={onDismiss}
      className={cn(
        'pointer-events-auto block w-full rounded-t-2xl px-4 pt-5 pb-6 text-left text-ink outline-none',
        'focus-visible:ring-4 focus-visible:ring-teal/40',
        gold ? 'bg-gold' : 'bg-teal-light',
        !reduced && 'animate-in slide-in-from-bottom duration-300',
      )}
    >
      {isPersonalBest && <span className="fl-tag mb-2 bg-ink text-white">{RECORD_MESSAGES.best}</span>}
      <p className="text-[26px] leading-tight font-extrabold">
        {result === 'up' ? (
          <>
            {upLabel} <span className="fl-num text-[40px]">{upAmount}</span>
          </>
        ) : result === 'same' ? (
          GHOST_MESSAGES.same
        ) : result === 'down' ? (
          GHOST_MESSAGES.down
        ) : (
          RECORD_MESSAGES.recorded
        )}
      </p>
      <p className="mt-1 text-sm opacity-85">{summary}</p>
    </button>
  );
}
