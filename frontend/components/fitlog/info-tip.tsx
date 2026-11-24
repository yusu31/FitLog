'use client';

import { useId, useState, type ReactNode } from 'react';
import { CircleHelp } from 'lucide-react';
import { cn } from 'cn';

// 「?」を押すと開く説明。2行以上の説明文で画面が文字だらけになるのを防ぐ（最初の1回だけ見せる説明には使わない）。
// ボタンは本物の <button>（Tab で届き、Enter・Space で開閉）。開いているかは aria-expanded で読み上げられる。
// Esc で閉じる。ボタンは 44px 以上。heading を渡すと、見出しなどと同じ行に「?」を並べる（「?」だけが1行を取らない）
export function InfoTip({ label, heading, children, className, panelClassName }: { label: string; heading?: ReactNode; children: ReactNode; className?: string; panelClassName?: string }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const button = (
    <button
      type="button"
      aria-label={label}
      aria-expanded={open}
      aria-controls={panelId}
      onClick={() => setOpen((v) => !v)}
      className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-brand outline-none hover:bg-teal-light focus-visible:ring-4 focus-visible:ring-teal/40"
    >
      <CircleHelp aria-hidden className="size-5" />
    </button>
  );
  return (
    <div className={cn('text-note', className)} onKeyDown={(e) => e.key === 'Escape' && open && setOpen(false)}>
      {heading ? (
        <div className="-my-2 flex items-center justify-between gap-2">
          {heading}
          {button}
        </div>
      ) : (
        button
      )}
      <div id={panelId} hidden={!open} className={cn('mt-1 text-note leading-relaxed font-bold text-fg-muted', panelClassName)}>
        {children}
      </div>
    </div>
  );
}
