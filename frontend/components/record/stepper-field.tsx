'use client';

import { Minus, Plus } from 'lucide-react';
import { useState } from 'react';
import { cn } from 'cn';

const roundButton = cn(
  'flex size-14 shrink-0 items-center justify-center rounded-full bg-line text-ink outline-none',
  'shadow-[0_4px_0_var(--color-line-dark)] transition-[transform,box-shadow] duration-75',
  'active:translate-y-1 active:shadow-none focus-visible:ring-4 focus-visible:ring-teal/40',
  'disabled:opacity-50 motion-reduce:transition-none',
);

const bigButton = cn(
  'inline-flex min-h-11 min-w-24 items-center justify-center rounded-fl bg-line px-4 text-sm font-extrabold text-ink outline-none',
  'shadow-[0_3px_0_var(--color-line-dark)] active:translate-y-0.5 active:shadow-none focus-visible:ring-4 focus-visible:ring-teal/40',
);

// 大きな数字 ＋ 左右の丸ボタン（＋/−）。数字は直接打てる。
// 打っている途中は入力のままにして、範囲に入った値はすぐ反映し、範囲の外は入力欄から離れたときに範囲へ収める
export function StepperField({
  label,
  unit,
  value,
  step,
  min,
  max,
  stepLabel,
  onChange,
  clamp,
  onStep,
  onBigStep,
  bigStepLabel,
  color,
}: {
  label: string;
  unit: string;
  value: number;
  step: number;
  min: number;
  max: number;
  stepLabel: string;
  onChange: (next: number) => void;
  clamp: (n: number) => number;
  onStep: (dir: 1 | -1) => void;
  // 大きい動かし方（重量だけ。例: ±10kg）。無ければ出さない
  onBigStep?: (dir: 1 | -1) => void;
  bigStepLabel?: string;
  color?: string;
}) {
  const [typing, setTyping] = useState<string | null>(null);
  return (
    <div className="space-y-2">
    <div className="flex items-center justify-between gap-2">
      <button type="button" className={roundButton} aria-label={`${label === '回数' ? '回数を 1回' : `重量を ${stepLabel}`} へらす`} onClick={() => onStep(-1)}>
        <Minus aria-hidden className="size-6" />
      </button>
      <div className="flex min-w-0 flex-1 items-baseline justify-center gap-1.5">
        <input
          type="number"
          inputMode={label === '回数' ? 'numeric' : 'decimal'}
          aria-label={label}
          min={min}
          max={max}
          step={step}
          value={typing ?? String(value)}
          onChange={(e) => {
            setTyping(e.target.value);
            const n = Number(e.target.value);
            if (e.target.value !== '' && Number.isFinite(n) && n >= min && n <= max) onChange(clamp(n));
          }}
          onBlur={(e) => {
            const n = Number(e.target.value);
            if (e.target.value !== '' && Number.isFinite(n)) onChange(clamp(n));
            setTyping(null);
          }}
          className={cn(
            'fl-num field-sizing-content max-w-[9ch] min-w-[3ch] rounded-lg border-b-4 border-dashed border-line-dark bg-face text-center text-[56px] leading-none outline-none',
            'focus-visible:ring-4 focus-visible:ring-teal/40 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
            color ?? 'text-ink',
          )}
        />
        <span className="text-xl font-extrabold text-sub-strong">{unit}</span>
      </div>
      <button type="button" className={roundButton} aria-label={`${label === '回数' ? '回数を 1回' : `重量を ${stepLabel}`} ふやす`} onClick={() => onStep(1)}>
        <Plus aria-hidden className="size-6" />
      </button>
    </div>
    {onBigStep && bigStepLabel && (
      <div className="flex justify-center gap-3">
        <button type="button" className={bigButton} aria-label={`重量を ${bigStepLabel} へらす`} onClick={() => onBigStep(-1)}>
          −{bigStepLabel}
        </button>
        <button type="button" className={bigButton} aria-label={`重量を ${bigStepLabel} ふやす`} onClick={() => onBigStep(1)}>
          ＋{bigStepLabel}
        </button>
      </div>
    )}
    </div>
  );
}
