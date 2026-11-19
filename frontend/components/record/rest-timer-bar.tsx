'use client';

import { Minus, Plus, Timer } from 'lucide-react';
import { useEffect, useState } from 'react';
import { REST_MAX_S, REST_MIN_S, formatRest, remainingSeconds, stepRestSeconds, writeRestSeconds } from '@/lib/rest-timer';

// 休憩タイマー（F-34）。「できた」のあと自動で始まる。±15秒で長さを変えると端末に控える。
// 終了時刻から残りを出す（画面が裏に回っても狂わない）。終わったら振動（対応端末だけ）と「休憩おわり」。音は出さない。
// 残りの数字は毎秒読み上げない（読み上げるのは「はじめました」と「おわり」だけ）
export function RestTimerBar({ startedAt, initialSeconds, onClose }: { startedAt: number; initialSeconds: number; onClose: () => void }) {
  const [total, setTotal] = useState(initialSeconds);
  const [now, setNow] = useState(startedAt);

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
    <section aria-label="休憩タイマー" className="fl-slab mx-4 mt-2 space-y-2 border-teal-light bg-teal-light/40 px-4 py-3">
      <p role="status" className="sr-only">
        {done ? '休憩おわり' : '休憩をはじめました'}
      </p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Timer aria-hidden className="hidden size-5 shrink-0 text-teal-dark min-[260px]:block" />
        <p aria-hidden className="min-w-0 flex-1 basis-28 font-extrabold">
          {done ? (
            '休憩おわり。次のセットへ'
          ) : (
            <>
              休憩 <span data-testid="rest-remaining" className="fl-num text-2xl">{formatRest(remaining)}</span>
            </>
          )}
        </p>
        {done ? null : (
          <>
            <button
              type="button"
              aria-label="休憩を15秒短くする"
              disabled={total <= REST_MIN_S}
              onClick={() => change(-1)}
              className="flex size-11 shrink-0 items-center justify-center rounded-fl bg-white text-teal-dark outline-none focus-visible:ring-4 focus-visible:ring-teal/40 disabled:opacity-40"
            >
              <Minus aria-hidden className="size-5" />
            </button>
            <button
              type="button"
              aria-label="休憩を15秒長くする"
              disabled={total >= REST_MAX_S}
              onClick={() => change(1)}
              className="flex size-11 shrink-0 items-center justify-center rounded-fl bg-white text-teal-dark outline-none focus-visible:ring-4 focus-visible:ring-teal/40 disabled:opacity-40"
            >
              <Plus aria-hidden className="size-5" />
            </button>
          </>
        )}
      </div>
      {!done && (
        <div aria-hidden className="h-2 overflow-hidden rounded-full bg-white">
          <div className="h-full bg-teal-dark" style={{ width: `${Math.round((remaining / total) * 100)}%` }} />
        </div>
      )}
      <button
        type="button"
        aria-label={done ? '休憩をとじる' : '休憩をスキップ'}
        onClick={onClose}
        className="min-h-11 w-full rounded-fl bg-white text-sm font-extrabold text-teal-dark outline-none focus-visible:ring-4 focus-visible:ring-teal/40"
      >
        {done ? 'とじる' : 'スキップ'}
      </button>
    </section>
  );
}
