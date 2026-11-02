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
  color?: string;
}) {
  const [typing, setTyping] = useState<string | null>(null);
  return (
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
            'fl-num field-sizing-content max-w-[9ch] min-w-[2ch] rounded-lg bg-transparent text-center text-[56px] leading-none outline-none',
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
  );
}
