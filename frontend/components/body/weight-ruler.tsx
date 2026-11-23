'use client';

import { useEffect, useRef, type KeyboardEvent } from 'react';
import { BODY_MESSAGES, RULER_PX, WEIGHT_MAX, WEIGHT_MIN, clampWeight } from '@/lib/body/body';

const STEPS = (WEIGHT_MAX - WEIGHT_MIN) * 10;
const KG_LABELS = Array.from({ length: WEIGHT_MAX - WEIGHT_MIN + 1 }, (_, i) => WEIGHT_MIN + i);
// 0.1kg ごと・0.5kg ごと・1kg ごとの目盛りを、グラデーションの縞で描く
const TICKS = [
  `repeating-linear-gradient(90deg, var(--color-fg) 0 2px, transparent 2px ${RULER_PX * 10}px) 0 8px / 100% 36px no-repeat`,
  `repeating-linear-gradient(90deg, var(--color-fg-muted) 0 1px, transparent 1px ${RULER_PX * 5}px) 0 8px / 100% 24px no-repeat`,
  `repeating-linear-gradient(90deg, var(--color-line-dark) 0 1px, transparent 1px ${RULER_PX}px) 0 8px / 100% 14px no-repeat`,
].join(', ');

// 体重のルーラー（ものさし）。左右に動かして 0.1kg ずつ合わせる。矢印キーでも動く（←→ で 0.1・PageUp/Down で 1）。
// 動かすと onChange(kg) が呼ばれる。value を変えたとき（キー操作など）は、ものさしの位置も合わせる
export function WeightRuler({ value, onChange }: { value: number; onChange: (kg: number) => void }) {
  const scroller = useRef<HTMLDivElement>(null);
  const latest = useRef(value);

  // 外から値が変わったら、ものさしの位置を合わせる（自分が動かした値なら何もしない）
  useEffect(() => {
    latest.current = value;
    const el = scroller.current;
    if (!el) return;
    const left = Math.round((value - WEIGHT_MIN) * 10) * RULER_PX;
    if (Math.abs(el.scrollLeft - left) > 0.5) el.scrollLeft = left;
  }, [value]);

  function onScroll() {
    const el = scroller.current;
    if (!el) return;
    const next = clampWeight(WEIGHT_MIN + Math.round(el.scrollLeft / RULER_PX) / 10);
    if (next !== latest.current) {
      latest.current = next;
      onChange(next);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step = { ArrowLeft: -0.1, ArrowDown: -0.1, ArrowRight: 0.1, ArrowUp: 0.1, PageDown: -1, PageUp: 1 }[event.key];
    if (step === undefined) return;
    event.preventDefault();
    onChange(clampWeight(value + step));
  }

  return (
    <div>
      <div className="relative h-24 rounded-fl border-2 border-line bg-surface">
        <div
          ref={scroller}
          role="slider"
          tabIndex={0}
          aria-label={BODY_MESSAGES.weightLabel}
          aria-valuemin={WEIGHT_MIN}
          aria-valuemax={WEIGHT_MAX}
          aria-valuenow={value}
          aria-valuetext={`${value.toFixed(1)}kg`}
          onScroll={onScroll}
          onKeyDown={onKeyDown}
          className="absolute inset-0 cursor-grab touch-pan-x overflow-x-scroll overflow-y-hidden rounded-fl outline-none [scrollbar-width:none] focus-visible:ring-4 focus-visible:ring-teal/40 [&::-webkit-scrollbar]:hidden"
        >
          {/* 幅は「画面の幅＋目盛りの長さ」。目盛りは画面の真ん中から始まり、いちばん端の値でも針の位置に来られる */}
          <div aria-hidden className="relative h-full" style={{ width: `calc(100% + ${STEPS * RULER_PX}px)` }}>
            <div className="absolute inset-y-0 left-1/2" style={{ width: STEPS * RULER_PX + 2, background: TICKS }}>
              {KG_LABELS.map((kg) => (
                <span key={kg} className="absolute top-16 -translate-x-1/2 text-note font-bold text-fg-muted" style={{ left: (kg - WEIGHT_MIN) * 10 * RULER_PX }}>
                  {kg}
                </span>
              ))}
            </div>
          </div>
        </div>
        <span aria-hidden className="pointer-events-none absolute inset-y-1.5 left-1/2 -ml-[1.5px] w-[3px] rounded-sm bg-coral" />
      </div>
      <p className="mt-1 text-center text-note text-fg-muted">{BODY_MESSAGES.rulerHint}</p>
    </div>
  );
}
