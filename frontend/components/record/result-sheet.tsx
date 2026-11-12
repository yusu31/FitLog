'use client';

import { useEffect } from 'react';
import { cn } from 'cn';
import { BodyFigure } from '@/components/me/body-figure';
import { Sprite } from '@/components/fitlog/sprite';
import type { BodyPart } from '@/lib/api/generated';
import { BODY_PART_LABEL, BODY_PART_ORDER } from '@/lib/body-parts';
import { levelsOf } from '@/lib/heatmap';
import { GHOST_MESSAGES, RECORD_MESSAGES, ghostUpMessage } from '@/lib/messages';
import { usePrefersReducedMotion } from '@/lib/use-browser-state';
import type { GhostResult } from '@/lib/shared/ghost';

// 0.8秒だと文字が読めず、キャラの動き（ガッツポーズは 320ms で2コマ）も分からなかった（公開版で本人が確認・2026-11-11）。
// 主な1行（約16字）を読め、キャラが数回動く長さにする。タップで飛ばせるので、急ぐ人は待たなくてよい
export const SHEET_MS = 3000;

export type SheetData = {
  setId: string;
  result: GhostResult | null;
  diff: number;
  isPersonalBest: boolean;
  summary: string;
  // 電波なしで押したとき、直後に添える1行（保存したこと・あとで送ること）
  note?: string;
  // 今日の記録で使った部位（F-19）。祝福の中で体の図を光らせる。無ければ出さない
  parts?: readonly BodyPart[];
};

// 結果シート（features.md 2.6）。「できた」の直後に 3秒出し、タップで飛ばせる。
// 動きを減らす設定のときは、動かさず表示だけにする。責める言葉・悪い色は使わない（下回りも同じ明るい面）
export function ResultSheet({ sheet, onDismiss }: { sheet: SheetData | null; onDismiss: () => void }) {
  const reduced = usePrefersReducedMotion();
  const key = sheet?.setId;

  useEffect(() => {
    if (!key) return;
    const timer = setTimeout(onDismiss, SHEET_MS);
    return () => clearTimeout(timer);
    // 同じセットの結果が応答で直されても、3秒は数え直さない
  }, [key, onDismiss]);

  // 読み上げ用の領域は常に置き、中身だけ出し入れする（あとから挿入された領域は読まれないことがあるため）
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed bottom-0 left-1/2 z-20 w-full max-w-[430px] -translate-x-1/2">
      {sheet && <Body sheet={sheet} reduced={reduced} onDismiss={onDismiss} />}
    </div>
  );
}

function Body({ sheet, reduced, onDismiss }: { sheet: SheetData; reduced: boolean; onDismiss: () => void }) {
  const { result, diff, isPersonalBest, summary, note, parts } = sheet;
  const gold = result === 'up' || isPersonalBest;
  const [upLabel, upAmount] = ghostUpMessage(diff).split(' ');
  return (
    <button
      type="button"
      data-testid="result-sheet"
      data-motion={reduced ? 'reduced' : 'full'}
      onClick={onDismiss}
      className={cn(
        'pointer-events-auto relative block w-full rounded-t-2xl px-4 pt-5 pb-6 text-left text-ink outline-none',
        'focus-visible:ring-4 focus-visible:ring-teal/40',
        gold ? 'bg-gold' : 'bg-teal-light',
        !reduced && 'animate-in slide-in-from-bottom duration-300',
      )}
    >
      <Sprite pose={isPersonalBest ? 'pb' : 'cheer'} size={80} className="absolute right-3 -top-16" />
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
      {note && <p className="mt-1 text-xs font-bold opacity-85">{note}</p>}
      {parts && parts.length > 0 && <TodayParts parts={parts} />}
    </button>
  );
}

// 今日きたえた部位（F-19）。ヒートマップ（F-12）と同じ体の図で、使った部位だけを一番濃い色にする。色だけに頼らず、部位名も書く
function TodayParts({ parts }: { parts: readonly BodyPart[] }) {
  const levels = levelsOf(parts.map((bodyPart) => ({ bodyPart, sets: 4 })));
  const names = BODY_PART_ORDER.filter((p) => parts.includes(p)).map((p) => BODY_PART_LABEL[p]);
  return (
    <div data-testid="today-parts" className="mt-3 flex items-center gap-3">
      <div className="flex gap-2 rounded-lg bg-white px-3 py-2">
        <BodyFigure view="front" levels={levels} size={36} />
        <BodyFigure view="back" levels={levels} size={36} />
      </div>
      <p className="text-sm font-bold">今日きたえたところ: {names.join('・')}</p>
    </div>
  );
}

