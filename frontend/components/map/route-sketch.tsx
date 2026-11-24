import { makeProjector, toPoints, type Pt } from '@/lib/map/sketch-geo';

export type SketchLine = { coords: readonly Pt[]; color: string; width?: number; dashed?: boolean };
export type SketchDot = { coord: Pt; color: string; r?: number };

const W = 320;
const H = 160;

// 地図が出せないときの代替（L13）。地図の背景は無しで、ルートの線と点だけを SVG で描く。
// 文字（距離・時間・理由）は呼び出し側が上に出す
export function RouteSketch({ lines, dots = [], label }: { lines: readonly SketchLine[]; dots?: readonly SketchDot[]; label: string }) {
  const all = [...lines.flatMap((l) => l.coords), ...dots.map((d) => d.coord)];
  if (all.length < 2) return null;
  const project = makeProjector(all, W, H, 14);
  return (
    <svg data-testid="route-sketch" role="img" aria-label={label} viewBox={`0 0 ${W} ${H}`} className="h-40 w-full rounded-fl bg-surface">
      {lines.map((l, i) => (
        <polyline
          key={i}
          points={toPoints(project, l.coords)}
          fill="none"
          stroke={l.color}
          strokeWidth={l.width ?? 4}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={l.dashed ? '6 6' : undefined}
        />
      ))}
      {dots.map((d, i) => {
        const [x, y] = project(d.coord);
        return <circle key={i} cx={x} cy={y} r={d.r ?? 6} fill={d.color} stroke="#ffffff" strokeWidth={2.5} />;
      })}
    </svg>
  );
}
