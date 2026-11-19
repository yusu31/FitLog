import { BODY_MESSAGES, chartShape, type ChartPoint } from '@/lib/body/body';

// 体重のグラフ。7日平均の線が主役（太く）、日々の体重の点はうすく。縦軸は kg の上端・下端だけ小さく添える
export function WeightChart({ points }: { points: ChartPoint[] }) {
  const shape = chartShape(points);
  if (!shape) {
    return <p className="rounded-lg bg-face px-3 py-6 text-center text-sm font-bold text-sub-strong">{BODY_MESSAGES.chartEmpty}</p>;
  }
  const last = points[points.length - 1];
  return (
    <figure>
      <svg
        role="img"
        aria-label={`体重のグラフ。最新は ${last.date} の ${last.kg}kg${last.avg7 === null ? '' : `、7日の平均は ${last.avg7}kg`}`}
        viewBox={`0 0 ${shape.width} ${shape.height}`}
        className="w-full"
      >
        {shape.dots.map((d) => (
          <circle key={d.date} data-testid="weight-dot" cx={d.x} cy={d.y} r={3} className="fill-teal-dark opacity-30" />
        ))}
        {shape.avgPath && <path data-testid="weight-avg-line" d={shape.avgPath} fill="none" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" className="stroke-teal-dark" />}
        <text x={2} y={12} className="fill-sub-strong text-[10px]">
          {shape.max}kg
        </text>
        <text x={2} y={shape.height - 4} className="fill-sub-strong text-[10px]">
          {shape.min}kg
        </text>
      </svg>
      <figcaption className="mt-1 text-xs text-sub-strong">{BODY_MESSAGES.chartHint}</figcaption>
    </figure>
  );
}
