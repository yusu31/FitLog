'use client';

import { useEffect, useState } from 'react';
import { cn } from 'cn';
import { usePrefersReducedMotion } from '@/lib/use-browser-state';

// ドット絵のキャラ（F-31）。LPC（Liberated Pixel Cup）の部品を 64×64 のコマにしたものを、順番に切り替えて動かす。
// コマは public/characters/{pose}_{n}.png。素材の作者とライセンスは public/characters/CREDITS.md と S-34 クレジット画面
export const POSES = {
  stretch: { frames: 3, seq: [0, 1, 2, 2, 1], ms: 420, name: '朝の伸び' },
  ready: { frames: 2, seq: [0, 1], ms: 300, name: '準備OK' },
  train: { frames: 2, seq: [0, 1, 1, 0], ms: 520, name: 'トレーニング中' },
  cheer: { frames: 2, seq: [0, 1], ms: 320, name: 'ガッツポーズ' },
  relax: { frames: 3, seq: [0, 1, 0, 1, 0, 1, 2, 0], ms: 700, name: 'くつろぎ' },
  idle: { frames: 2, seq: [0, 1], ms: 700, name: '待機' },
  welcome: { frames: 2, seq: [0, 1], ms: 420, name: 'おかえり' },
  react: { frames: 2, seq: [0, 1], ms: 450, name: '仲間への反応' },
  run: { frames: 8, seq: [0, 1, 2, 3, 4, 5, 6, 7], ms: 90, name: 'ラン' },
  pb: { frames: 2, seq: [0, 1], ms: 380, name: '自己ベスト' },
} as const;

export type PoseKey = keyof typeof POSES;

// 飾りなので読み上げからは外す（ポーズの名前は data-pose に残す）。「動きを減らす」設定のときは1コマ目で止める
export function Sprite({ pose, size = 128, className }: { pose: PoseKey; size?: number; className?: string }) {
  const { frames, seq, ms } = POSES[pose];
  const reduced = usePrefersReducedMotion();
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (reduced) return;
    const timer = setInterval(() => setStep((s) => (s + 1) % seq.length), ms);
    return () => clearInterval(timer);
  }, [reduced, seq.length, ms]);

  const current = reduced ? 0 : seq[step % seq.length];
  return (
    <div
      aria-hidden="true"
      data-testid="sprite"
      data-pose={pose}
      data-frame={current}
      className={cn('relative', className)}
      style={{ width: size, height: size }}
    >
      {Array.from({ length: frames }, (_, i) => (
        // 全コマを重ねて置き、表示だけ切り替える（切り替えのたびに画像を読み直さない）
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={i}
          src={`/characters/${pose}_${i}.png`}
          alt=""
          width={size}
          height={size}
          draggable={false}
          style={{ imageRendering: 'pixelated', position: 'absolute', inset: 0, visibility: i === current ? 'visible' : 'hidden' }}
        />
      ))}
    </div>
  );
}
