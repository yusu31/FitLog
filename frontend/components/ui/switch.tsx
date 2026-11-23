'use client';

import { cn } from '@/lib/utils';

// オン/オフのスイッチ。role=switch のボタン（読み上げでは「オン/オフ」と読まれる）。押せる大きさは 44px 以上
export function Switch({ label, checked, onChange, className }: { label: string; checked: boolean; onChange: (on: boolean) => void; className?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn('flex h-11 w-14 shrink-0 items-center justify-center rounded-fl outline-none focus-visible:ring-4 focus-visible:ring-teal/40', className)}
    >
      <span aria-hidden className={cn('relative block h-7 w-12 rounded-full transition-colors', checked ? 'bg-teal-dark' : 'bg-line-dark')}>
        <span className={cn('absolute top-0.5 size-6 rounded-full bg-white shadow transition-[left]', checked ? 'left-[22px]' : 'left-0.5')} />
      </span>
    </button>
  );
}
