import type { ComponentProps } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

// 自前のチェックボックス。ブラウザ標準の四角（OS ごとに見た目が違う）の代わり。
// 本物の <input type="checkbox"> を画面の外に置き（sr-only）、見た目の四角をその隣に描く。
// だから読み上げ（role=checkbox）・キーボード（Space）・フォーム送信（name）は標準のまま動く。
// 四角は 24px、ラベルと合わせた押せる範囲は呼び出し側の label で 44px 以上にする
export function Checkbox({ className, ...props }: Omit<ComponentProps<'input'>, 'type'>) {
  return (
    <span className={cn('relative inline-flex size-6 shrink-0', className)}>
      <input type="checkbox" className="peer sr-only" {...props} />
      <span
        aria-hidden
        className={cn(
          'flex size-6 items-center justify-center rounded-md border-2 border-line-dark bg-surface text-white transition-colors',
          'peer-checked:border-teal-dark peer-checked:bg-teal-dark',
          'peer-focus-visible:ring-4 peer-focus-visible:ring-teal/40 peer-disabled:opacity-50',
          '[&>svg]:opacity-0 peer-checked:[&>svg]:opacity-100',
        )}
      >
        <Check className="size-4" strokeWidth={3.5} />
      </span>
    </span>
  );
}
