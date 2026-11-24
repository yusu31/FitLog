'use client';

import { useEffect, useRef, type KeyboardEvent } from 'react';
import { BODY_MESSAGES, RULER_PX, WEIGHT_MAX, WEIGHT_MIN, clampWeight } from '@/lib/body/body';
import { fromUnit, toUnit, type WeightUnit } from '@/lib/unit';

// ものさしの範囲は表示の単位で決める（kg は 20〜300、lb は 45〜661）。目盛りの数字は 1 ごと（kg なら 1kg ごと）に出す
const rangeOf = (unit: WeightUnit) => (unit === 'kg' ? { min: WEIGHT_MIN, max: WEIGHT_MAX } : { min: Math.ceil(toUnit(WEIGHT_MIN, 'lb')), max: Math.floor(toUnit(WEIGHT_MAX, 'lb')) });
// 0.1kg ごと・0.5kg ごと・1kg ごとの目盛りを、グラデーションの縞で描く
const TICKS = [
  `repeating-linear-gradient(90deg, var(--color-fg) 0 2px, transparent 2px ${RULER_PX * 10}px) 0 8px / 100% 36px no-repeat`,
  `repeating-linear-gradient(90deg, var(--color-fg-muted) 0 1px, transparent 1px ${RULER_PX * 5}px) 0 8px / 100% 24px no-repeat`,
  `repeating-linear-gradient(90deg, var(--color-line-dark) 0 1px, transparent 1px ${RULER_PX}px) 0 8px / 100% 14px no-repeat`,
].join(', ');

// 体重のルーラー（ものさし）。左右に動かして 0.1kg ずつ合わせる。矢印キーでも動く（←→ で 0.1・PageUp/Down で 1）。
// 動かすと onChange(kg) が呼ばれる。value を変えたとき（キー操作など）は、ものさしの位置も合わせる
export function WeightRuler({ value, onChange, unit = 'kg' }: { value: number; onChange: (kg: number) => void; unit?: WeightUnit }) {
  const scroller = useRef<HTMLDivElement>(null);
  // value は kg。ものさしの上では、表示の単位の数で扱う
  const shown = toUnit(value, unit);
  const { min, max } = rangeOf(unit);
  const steps = (max - min) * 10;
  const labels = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  const clampShown = (n: number) => Math.min(max, Math.max(min, Math.round(n * 10) / 10));
  const emit = (n: number) => onChange(clampWeight(fromUnit(clampShown(n), unit)));
  const latest = useRef(shown);

  // 外から値が変わったら、ものさしの位置を合わせる（自分が動かした値なら何もしない）
  useEffect(() => {
    latest.current = shown;
    const el = scroller.current;
    if (!el) return;
    const left = Math.round((clampShown(shown) - min) * 10) * RULER_PX;
    if (Math.abs(el.scrollLeft - left) > 0.5) el.scrollLeft = left;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown, unit]);

  function onScroll() {
    const el = scroller.current;
    if (!el) return;
    const next = clampShown(min + Math.round(el.scrollLeft / RULER_PX) / 10);
    if (next !== latest.current) {
      latest.current = next;
      emit(next);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step = { ArrowLeft: -0.1, ArrowDown: -0.1, ArrowRight: 0.1, ArrowUp: 0.1, PageDown: -1, PageUp: 1 }[event.key];
    if (step === undefined) return;
    event.preventDefault();
    emit(shown + step);
  }

  return (
    <div>
      <div className="relative h-24 rounded-fl border-2 border-line bg-surface">
        <div
          ref={scroller}
          role="slider"
          tabIndex={0}
          aria-label={`体重（${unit}）`}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={shown}
          aria-valuetext={`${shown.toFixed(1)}${unit}`}
          onScroll={onScroll}
          onKeyDown={onKeyDown}
          className="absolute inset-0 cursor-grab touch-pan-x overflow-x-scroll overflow-y-hidden rounded-fl outline-none [scrollbar-width:none] focus-visible:ring-4 focus-visible:ring-teal/40 [&::-webkit-scrollbar]:hidden"
        >
          {/* 幅は「画面の幅＋目盛りの長さ」。目盛りは画面の真ん中から始まり、いちばん端の値でも針の位置に来られる */}
          <div aria-hidden className="relative h-full" style={{ width: `calc(100% + ${steps * RULER_PX}px)` }}>
            <div className="absolute inset-y-0 left-1/2" style={{ width: steps * RULER_PX + 2, background: TICKS }}>
              {labels.map((n) => (
                <span key={n} data-testid="ruler-label" className="absolute top-16 -translate-x-1/2 text-note font-bold text-fg-muted" style={{ left: (n - min) * 10 * RULER_PX }}>
                  {n}
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
