import { PIXEL_ICONS, PIXEL_SIZE, pixelRuns, type PixelIconName, type PixelRows } from '@/lib/pixel-icons';

// 色の組（主役の色と、その影）。k（輪郭）はいつも濃い色（ダークでも変えない）、w・h は白
const ACCENTS = {
  teal: ['var(--color-teal)', 'var(--color-teal-dark)'],
  coral: ['var(--color-coral)', 'var(--color-coral-dark)'],
  gold: ['var(--color-gold)', 'var(--color-gold-dark)'],
  grape: ['var(--color-grape)', 'var(--color-grape-dark)'],
} as const;
export type PixelAccent = keyof typeof ACCENTS;

// ドット絵のアイコン（飾り。読み上げない）。1マスを1つの四角で描き、角を丸めない（shape-rendering: crispEdges）
export function PixelIcon({ name, rows, accent, size = 32, className }: { name?: PixelIconName; rows?: PixelRows; accent: PixelAccent; size?: number; className?: string }) {
  const [main, shade] = ACCENTS[accent];
  const fills: Record<string, string> = { k: 'var(--color-night)', a: main, b: shade, h: '#ffffffb3', w: '#ffffff' };
  const data = rows ?? PIXEL_ICONS[name ?? 'dumbbell'];
  return (
    <svg aria-hidden viewBox={`0 0 ${PIXEL_SIZE} ${PIXEL_SIZE}`} width={size} height={size} shapeRendering="crispEdges" className={className}>
      {pixelRuns(data).map((r) => (
        <rect key={`${r.x}-${r.y}`} x={r.x} y={r.y} width={r.w} height={1} fill={fills[r.ch] ?? 'none'} />
      ))}
    </svg>
  );
}
