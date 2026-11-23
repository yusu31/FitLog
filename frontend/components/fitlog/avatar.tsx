import { cn } from 'cn';
import { faceLayers, normalizeChara, SHEET_FRAMES, type CharaSettings } from '@/lib/chara';

// キャラの服の色から、丸の背景色を決める（キャラの顔が読める濃い色に寄せる）
export const AVATAR_BG: Record<string, string> = {
  teal: '#0e7f83',
  navy: '#1e2a3a',
  coral: '#c23b2d',
  purple: '#6a57cf',
  gold: '#8a6200',
  green: '#2f7d47',
};

// 顔の丸（D7-1・F-32）。ドット絵キャラの頭の部分だけを切り出して丸に入れ、丸の色はその人の服の色にする。
// avatar（キャラの設定）があれば、その人の髪・服・小物で描く。shirtColor だけ渡された古い呼び方は、既定のキャラ（idle_0.png）の丸になる。
// 切り出しの範囲は、画像の 横16〜48・縦10〜42（頭〜肩）。頭のまわりに透明な部分を残し、そこに服の色が見えるようにする（人の区別）。
// 飾りなので読み上げからは外す（名前は隣の文字にある）
const CROP = { x: 16, y: 10, size: 32, whole: 64 };

type AvatarProps = { size?: number; className?: string } & ({ avatar: Partial<Record<keyof CharaSettings, unknown>> | null | undefined; shirtColor?: never } | { shirtColor: string; avatar?: never });

export function Avatar({ shirtColor, avatar, size = 44, className }: AvatarProps) {
  const scale = size / CROP.size; // 切り出した32pxが、丸の大きさになる倍率
  const chara = avatar !== undefined ? normalizeChara(avatar) : null;
  const shirt = chara ? chara.shirtColor : shirtColor;
  const common = { position: 'absolute', left: -CROP.x * scale, top: -CROP.y * scale, imageRendering: 'pixelated', maxWidth: 'none' } as const;
  return (
    <span
      aria-hidden
      data-testid="avatar"
      className={cn('relative block shrink-0 overflow-hidden rounded-full', className)}
      style={{ width: size, height: size, backgroundColor: AVATAR_BG[shirt ?? ''] ?? AVATAR_BG.navy }}
    >
      {chara ? (
        // 部品のシート（コマ横並び）を重ね、1コマ目（idle_0）だけを見せる
        faceLayers(chara).map((url) => (
          <span
            key={url}
            data-layer={url}
            style={{ ...common, width: CROP.whole * scale, height: CROP.whole * scale, backgroundImage: `url(${url})`, backgroundSize: `${SHEET_FRAMES * CROP.whole * scale}px ${CROP.whole * scale}px`, backgroundRepeat: 'no-repeat' }}
          />
        ))
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src="/characters/idle_0.png" alt="" draggable={false} style={{ ...common, width: CROP.whole * scale, height: CROP.whole * scale }} />
      )}
    </span>
  );
}
