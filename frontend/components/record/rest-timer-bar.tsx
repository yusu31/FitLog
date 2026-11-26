'use client';

import { Minimize2, Minus, Plus, Timer } from 'lucide-react';
import { useEffect, useState } from 'react';
import { REST_MAX_S, REST_MIN_S, addRestSeconds, formatRest, remainingSeconds, stepRestSeconds, writeRestSeconds } from '@/lib/rest-timer';
import { ThickButton } from '@/components/fitlog/thick-button';

// 休憩タイマー（F-34）。「できた」のあと自動で始まる。
// ふだんは下に固定の1行の帯（残り時間・＋30秒・スキップ）。帯の時間を押すと、大きな数字と進捗バーと ±15秒の全画面になる（D3 L8）。
// 長さを変えると端末に控える。終了時刻から残りを出す（画面が裏に回っても狂わない）。終わったら振動（対応端末だけ）と「休憩おわり」。音は出さない。
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

  function save(next: number) {
    setTotal(next);
    writeRestSeconds(next);
  }
  const change = (direction: 1 | -1) => save(stepRestSeconds(total, direction));
  const status = (
    <p role="status" className="sr-only">
      {done ? '休憩おわり' : '休憩をはじめました'}
    </p>
  );
  const ring = 'outline-none focus-visible:ring-4 focus-visible:ring-teal/40';
  const skipLabel = done ? '休憩をとじる' : '休憩をスキップ';
  const skipText = done ? 'とじる' : 'スキップ';

  if (big) {
    return (
      <section aria-label="休憩タイマー" className="fixed inset-0 z-40 flex flex-col justify-center gap-5 bg-canvas px-6 py-8">
        {status}
        <p aria-hidden className="w-full text-center text-xl font-extrabold">
          {done ? (
            '休憩おわり。次のセットへ'
          ) : (
            <>
              休憩 <span data-testid="rest-remaining" className="fl-num block text-[96px] leading-none">{formatRest(remaining)}</span>
            </>
          )}
        </p>
        {!done && (
          <div aria-hidden className="h-2 overflow-hidden rounded-full bg-surface">
            <div className="h-full bg-teal-dark" style={{ width: `${Math.round((remaining / total) * 100)}%` }} />
          </div>
        )}
        <div className="flex flex-wrap items-center justify-center gap-3">
          {done ? null : (
            <>
              <ThickButton variant="icon" className="bg-surface text-brand" aria-label="休憩を15秒短くする" disabled={total <= REST_MIN_S} onClick={() => change(-1)}>
                <Minus aria-hidden className="size-5" />
              </ThickButton>
              <ThickButton variant="icon" className="bg-surface text-brand" aria-label="休憩を15秒長くする" disabled={total >= REST_MAX_S} onClick={() => change(1)}>
                <Plus aria-hidden className="size-5" />
              </ThickButton>
            </>
          )}
          <ThickButton variant="icon" className="bg-surface text-brand" aria-label="小さくして下の帯にもどす" aria-expanded onClick={() => setBig(false)}>
            <Minimize2 aria-hidden className="size-5" />
          </ThickButton>
        </div>
        <ThickButton variant="secondary" size="sm" className="w-full" aria-label={skipLabel} onClick={onClose}>
          {skipText}
        </ThickButton>
      </section>
    );
  }

  return (
    <section
      aria-label="休憩タイマー"
      className="fixed inset-x-0 bottom-0 z-40 mx-auto flex w-full max-w-[600px] items-center gap-2 rounded-t-fl border-t-4 border-teal-light bg-canvas px-3 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] shadow-[0_-4px_12px_rgba(0,0,0,0.08)]"
    >
      {status}
      <button
        type="button"
        aria-label="大きなタイマーで見る"
        aria-expanded={false}
        onClick={() => setBig(true)}
        className={`flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-fl px-1 text-left font-extrabold ${ring}`}
      >
        <Timer aria-hidden className="size-5 shrink-0 text-brand" />
        <span aria-hidden className="min-w-0">
          {done ? (
            '休憩おわり'
          ) : (
            <>
              休憩 <span data-testid="rest-remaining" className="fl-num text-2xl">{formatRest(remaining)}</span>
            </>
          )}
        </span>
      </button>
      {done ? null : (
        <ThickButton variant="secondary" size="sm" className="shrink-0" aria-label="休憩を30秒長くする" disabled={total >= REST_MAX_S} onClick={() => save(addRestSeconds(total))}>
          ＋30秒
        </ThickButton>
      )}
      <ThickButton variant="secondary" size="sm" className="shrink-0" aria-label={skipLabel} onClick={onClose}>
        {skipText}
      </ThickButton>
    </section>
  );
}
