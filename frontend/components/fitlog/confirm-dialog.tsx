'use client';

import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { ThickButton } from './thick-button';

type Props = {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  pendingLabel?: string;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

// 取り消せない操作の前に出す、確認のダイアログ（グループを出る、など）。
// 「やめる」に最初のフォーカスを置き、うっかり Enter で実行しないようにする。Escape と外側のタップでも閉じる。
// フォーカスはダイアログの中の2つのボタンだけを回り、閉じたら押す前の場所に戻す
export function ConfirmDialog({ open, title, description, confirmLabel, pendingLabel, pending, onConfirm, onCancel }: Props) {
  const titleId = useId();
  const descId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    // 開いている間は、うしろの画面が動かないようにする
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
      opener?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onCancel();
      return;
    }
    if (event.key !== 'Tab') return;
    const first = cancelRef.current;
    const last = confirmRef.current?.disabled ? cancelRef.current : confirmRef.current;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" onKeyDown={onKeyDown}>
      <div data-testid="dialog-backdrop" aria-hidden onClick={onCancel} className="absolute inset-0 bg-ink/50" />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="fl-slab relative m-4 w-full max-w-[398px] space-y-3 px-5 py-5 shadow-lg"
      >
        <h2 id={titleId} className="text-lg font-extrabold">
          {title}
        </h2>
        <p id={descId} className="text-sm leading-relaxed font-bold text-sub-strong [word-break:auto-phrase]">
          {description}
        </p>
        <div className="flex gap-2 pt-1">
          <ThickButton ref={cancelRef} tone="white" size="sm" onClick={onCancel} className="min-h-12 flex-1">
            やめる
          </ThickButton>
          <ThickButton ref={confirmRef} tone="coral" size="sm" onClick={onConfirm} disabled={pending} className="min-h-12 flex-1">
            {pending ? (pendingLabel ?? confirmLabel) : confirmLabel}
          </ThickButton>
        </div>
      </div>
    </div>
  );
}
