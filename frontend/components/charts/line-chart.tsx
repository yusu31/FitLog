import { lineShape, type LinePoint } from '@/lib/charts';

// 折れ線グラフ（体重・種目の最大重量）。点はうすく、線は太く。縦軸は上端・下端の数字だけ小さく添える
export function LineChart({ points, unit }: { points: readonly LinePoint[]; unit: string }) {
  const s = lineShape(points);
  if (!s) return null;
  return (
    <svg aria-hidden viewBox={`0 0 ${s.width} ${s.height}`} className="w-full" data-testid="line-chart">
      {s.dots.map((d) => (
        <circle key={d.date} cx={d.x} cy={d.y} r={3} className="fill-brand opacity-40" />
      ))}
      {s.dots.length > 1 && <path d={s.path} fill="none" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className="stroke-brand" />}
      <text x={2} y={12} className="fill-fg-muted text-note">
        {s.max}
        {unit}
      </text>
      <text x={2} y={s.height - 4} className="fill-fg-muted text-note">
        {s.min}
        {unit}
      </text>
    </svg>
  );
}
