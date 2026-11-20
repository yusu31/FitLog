import { cn } from 'cn';

// キャラの服の色から、丸の背景色を決める（キャラの顔が読める濃い色に寄せる）
export const AVATAR_BG: Record<string, string> = {
  teal: '#0e7f83',
  navy: '#1e2a3a',
  coral: '#c23b2d',
  purple: '#6a57cf',
  gold: '#8a6200',
};

// 顔の丸（D7-1）。ドット絵キャラ（public/characters/idle_0.png・64×64）の頭の部分だけを切り出して丸に入れ、
// 丸の色はその人の服の色にする。全員同じキャラなので、人の区別は丸の色と名前で付ける。
// 切り出しの範囲は、画像の 横20〜44・縦13〜37（頭〜首）。飾りなので読み上げからは外す（名前は隣の文字にある）
const CROP = { x: 20, y: 13, size: 24, whole: 64 };

export function Avatar({ shirtColor, size = 44, className }: { shirtColor: string; size?: number; className?: string }) {
  const scale = size / CROP.size; // 切り出した24pxが、丸の大きさになる倍率
  return (
    <span
      aria-hidden
      data-testid="avatar"
      className={cn('relative block shrink-0 overflow-hidden rounded-full', className)}
      style={{ width: size, height: size, backgroundColor: AVATAR_BG[shirtColor] ?? AVATAR_BG.navy }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/characters/idle_0.png"
        alt=""
        draggable={false}
        style={{
          position: 'absolute',
          width: CROP.whole * scale,
          height: CROP.whole * scale,
          left: -CROP.x * scale,
          top: -CROP.y * scale,
          imageRendering: 'pixelated',
          maxWidth: 'none',
        }}
      />
    </span>
  );
}
