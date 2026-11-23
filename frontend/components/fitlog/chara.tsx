'use client';

import { useEffect, useState } from 'react';
import { cn } from 'cn';
import { POSES, type PoseKey } from '@/components/fitlog/sprite';
import { charaLayers, POSE_FRAMES, SHEET_FRAMES, type CharaSettings } from '@/lib/chara';
import { usePrefersReducedMotion } from '@/lib/use-browser-state';

// 組み立てたキャラ（F-32）。部品のシート（64px のコマを横に28枚）を重ね、いまのコマの位置だけを見せる。
// Sprite（決まった見た目の1枚絵）と同じポーズ・同じ動き。「動きを減らす」設定のときは1コマ目で止める。飾りなので読み上げからは外す
export function Chara({ settings, pose = 'idle', size = 128, animate = true, className }: { settings: CharaSettings; pose?: PoseKey; size?: number; animate?: boolean; className?: string }) {
  const reduced = usePrefersReducedMotion();
  const { seq, ms } = POSES[pose];
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (reduced || !animate) return;
    const timer = setInterval(() => setStep((s) => (s + 1) % seq.length), ms);
    return () => clearInterval(timer);
  }, [reduced, animate, seq.length, ms, pose]);

  const frame = POSE_FRAMES[pose].start + (reduced || !animate ? 0 : seq[step % seq.length]);
  return (
    <div aria-hidden="true" data-testid="chara" data-pose={pose} data-frame={frame} className={cn('relative shrink-0', className)} style={{ width: size, height: size }}>
      {charaLayers(settings).map((url) => (
        <div
          key={url}
          data-layer={url}
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `url(${url})`,
            backgroundSize: `${SHEET_FRAMES * size}px ${size}px`,
            backgroundPosition: `${-frame * size}px 0`,
            backgroundRepeat: 'no-repeat',
            imageRendering: 'pixelated',
          }}
        />
      ))}
    </div>
  );
}
