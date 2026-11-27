import { cn } from 'cn';

// FitLog のロゴ（ダンベルの印）。public/logo.svg と同じ絵を、画面の中に直接描く（画像を取りにいかないので、オフラインでも出る）。
// 色は docs/design.md の役割の色: 濃ティールの地・白のバー・金のグリップ。
// withName を付けると右に「FitLog」の字を添える。印だけのときは aria-label で名前を付ける（読み上げ用）
export function Logo({ size = 40, withName = false, className }: { size?: number; withName?: boolean; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)} data-testid="logo">
      <svg width={size} height={size} viewBox="0 0 64 64" role={withName ? undefined : 'img'} aria-label={withName ? undefined : 'FitLog'} aria-hidden={withName ? true : undefined} className="shrink-0">
        <rect width="64" height="64" rx="14" fill="#0e7f83" />
        <g fill="#ffffff">
          <rect x="8" y="22" width="7" height="20" rx="2.5" />
          <rect x="16" y="17" width="8" height="30" rx="3" />
          <rect x="49" y="22" width="7" height="20" rx="2.5" />
          <rect x="40" y="17" width="8" height="30" rx="3" />
        </g>
        <rect x="24" y="29" width="16" height="6" rx="3" fill="#ffc21a" />
      </svg>
      {withName && <span className="font-extrabold tracking-wider">FitLog</span>}
    </span>
  );
}
