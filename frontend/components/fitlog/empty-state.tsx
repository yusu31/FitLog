import type { ReactNode } from 'react';
import { cn } from 'cn';
import { Sprite, type PoseKey } from '@/components/fitlog/sprite';

// 空の画面（記録0件・仲間1人・通知0件など）の共通の部品。「キャラのポーズ＋なぜ空か＋次の一手」を1か所で決める。
// title は「いまは空」と伝える一文、hint は次に何をすればいいか、action は次の一手のボタン（あれば）。
// character を渡すと Sprite の代わりに差し替えられる（自分の見た目を出したい画面は MyChara を渡す）。
// 飾りのキャラは読み上げない（Sprite が aria-hidden）。出るときだけ小さくはねる（動きを減らす設定では止まる。globals.css の fl-pop-in）
export function EmptyState({
  title,
  hint,
  action,
  pose = 'idle',
  character,
  as: Tag = 'div',
  className,
}: {
  title: string;
  hint?: ReactNode;
  action?: ReactNode;
  pose?: PoseKey;
  character?: ReactNode;
  as?: 'div' | 'li' | 'section';
  className?: string;
}) {
  return (
    <Tag data-testid="empty-state" className={cn('fl-slab fl-pop-in flex flex-col items-center gap-1 px-4 py-5 text-center', className)}>
      {character ?? <Sprite pose={pose} size={80} />}
      <p className="text-base font-extrabold">{title}</p>
      {hint && <p className="text-note font-bold text-fg-muted">{hint}</p>}
      {action && <div className="mt-2 w-full max-w-xs">{action}</div>}
    </Tag>
  );
}
