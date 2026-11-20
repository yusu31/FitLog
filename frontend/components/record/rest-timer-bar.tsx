'use client';

import { Maximize2, Minimize2, Minus, Plus, Timer } from 'lucide-react';
import { useEffect, useState } from 'react';
import { REST_MAX_S, REST_MIN_S, formatRest, remainingSeconds, stepRestSeconds, writeRestSeconds } from '@/lib/rest-timer';

// 休憩タイマー（F-34）。「できた」のあと自動で始まる。±15秒で長さを変えると端末に控える。
// 終了時刻から残りを出す（画面が裏に回っても狂わない）。終わったら振動（対応端末だけ）と「休憩おわり」。音は出さない。
// 残りの数字は毎秒読み上げない（読み上げるのは「はじめました」と「おわり」だけ）
export function RestTimerBar({ startedAt, initialSeconds, onClose }: { startedAt: number; initialSeconds: number; onClose: () => void }) {
  const [total, setTotal] = useState(initialSeconds);
  const [now, setNow] = useState(startedAt);
  // 下に固定の帯（ふだん）／大きなタイマーのシート（帯を押したとき）。部品は1つで、並びと大きさだけ変える
  const [big, setBig] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const remaining = remainingSeconds(startedAt + total * 1000, now);
  const done = remaining === 0;

  useEffect(() => {
    if (done && typeof navigator.vibrate === 'function') navigator.vibrate(200);
  }, [done]);

  function change(direction: 1 | -1) {
    const next = stepRestSeconds(total, direction);
    setTotal(next);
    writeRestSeconds(next);
  }

  return (
    <section
      aria-label="休憩タイマー"
      className={
        big
          ? 'fixed inset-0 z-40 flex flex-col justify-center gap-5 bg-canvas px-6 py-8'
          : 'fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-[600px] space-y-2 rounded-t-fl border-t-4 border-teal-light bg-canvas px-4 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.08)]'
      }
    >
      <p role="status" className="sr-only">
        {done ? '休憩おわり' : '休憩をはじめました'}
      </p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Timer aria-hidden className="hidden size-5 shrink-0 text-brand min-[260px]:block" />
        <p aria-hidden className={big ? 'w-full text-center text-xl font-extrabold' : 'min-w-0 flex-1 basis-28 font-extrabold'}>
          {done ? (
            '休憩おわり。次のセットへ'
          ) : (
            <>
              休憩 <span data-testid="rest-remaining" className={big ? 'fl-num block text-[96px] leading-none' : 'fl-num text-2xl'}>{formatRest(remaining)}</span>
            </>
          )}
        </p>
        <button
          type="button"
          aria-label={big ? '小さくして下の帯にもどす' : '大きなタイマーで見る'}
          aria-expanded={big}
          onClick={() => setBig((v) => !v)}
          className="flex size-11 shrink-0 items-center justify-center rounded-fl bg-surface text-brand outline-none focus-visible:ring-4 focus-visible:ring-teal/40"
        >
          {big ? <Minimize2 aria-hidden className="size-5" /> : <Maximize2 aria-hidden className="size-5" />}
        </button>
        {done ? null : (
          <>
            <button
              type="button"
              aria-label="休憩を15秒短くする"
              disabled={total <= REST_MIN_S}
              onClick={() => change(-1)}
              className="flex size-11 shrink-0 items-center justify-center rounded-fl bg-surface text-brand outline-none focus-visible:ring-4 focus-visible:ring-teal/40 disabled:opacity-40"
            >
              <Minus aria-hidden className="size-5" />
            </button>
            <button
              type="button"
              aria-label="休憩を15秒長くする"
              disabled={total >= REST_MAX_S}
              onClick={() => change(1)}
              className="flex size-11 shrink-0 items-center justify-center rounded-fl bg-surface text-brand outline-none focus-visible:ring-4 focus-visible:ring-teal/40 disabled:opacity-40"
            >
              <Plus aria-hidden className="size-5" />
            </button>
          </>
        )}
      </div>
      {!done && (
        <div aria-hidden className="h-2 overflow-hidden rounded-full bg-surface">
          <div className="h-full bg-teal-dark" style={{ width: `${Math.round((remaining / total) * 100)}%` }} />
        </div>
      )}
      <button
        type="button"
        aria-label={done ? '休憩をとじる' : '休憩をスキップ'}
        onClick={onClose}
        className="min-h-11 w-full rounded-fl bg-surface text-sm font-extrabold text-brand outline-none focus-visible:ring-4 focus-visible:ring-teal/40"
      >
        {done ? 'とじる' : 'スキップ'}
      </button>
    </section>
  );
}
