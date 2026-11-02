import type { ReactNode } from 'react';
import { cn } from 'cn';

// タブの無い全画面の枠（種目を選ぶ・記録。docs/screen-design.md 1章）。AppShell と同じ幅・同じ背景にそろえる。
// 下に固定のボタンを置く画面は、footer を渡す（スマホの切り欠き・ホームバーを避けた余白つき）
export function FullScreen({
  children,
  footer,
  className,
}: {
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <div className="min-h-dvh bg-[#e9ecef]">
      <div className={cn('relative mx-auto flex min-h-dvh max-w-[430px] flex-col overflow-x-clip bg-white', className)}>
        <main className="flex flex-1 flex-col">{children}</main>
        {footer && (
          <div className="sticky bottom-0 z-10 bg-white px-4 pt-2 pb-[max(14px,env(safe-area-inset-bottom))]">{footer}</div>
        )}
      </div>
    </div>
  );
}
