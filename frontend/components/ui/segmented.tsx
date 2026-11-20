'use client';

import { cn } from '@/lib/utils';

export type SegmentedOption<T extends string> = { value: T; label: string };

// 横に並ぶ選択ボタン（どれか1つを選ぶ）。ブラウザ標準のラジオ（青い丸）の代わり。
// role=radiogroup の中に role=radio のボタンを置くので、読み上げ・テストからはラジオとして扱われる
export function Segmented<T extends string>({
  legend,
  options,
  value,
  onChange,
  className,
}: {
  legend: string;
  options: readonly SegmentedOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={legend} className={cn('flex flex-wrap gap-2', className)}>
      {options.map((o) => {
        const checked = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={checked}
            onClick={() => onChange(o.value)}
            className={cn(
              'min-h-11 rounded-fl px-3 text-sm font-bold outline-none focus-visible:ring-4 focus-visible:ring-teal/40',
              checked ? 'bg-teal-dark text-white' : 'bg-teal-light text-fg',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
