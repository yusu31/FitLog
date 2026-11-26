import { barShape } from '@/lib/charts';

// 棒グラフ（直近12週など）。0 の週は土台の線だけ。右端が最新。目標線は引かない（F-27）
export function BarChart({ values, highlightLast = true }: { values: readonly number[]; highlightLast?: boolean }) {
  const s = barShape(values);
  return (
    <svg aria-hidden viewBox={`0 0 ${s.width} ${s.height}`} className="w-full" data-testid="bar-chart">
      <line x1={8} x2={s.width - 8} y1={s.height - 16} y2={s.height - 16} className="stroke-line" strokeWidth={2} />
      {s.bars.map((b, i) =>
        b.h === 0 ? null : (
          <rect key={i} data-testid="bar" x={b.x} y={b.y} width={b.w} height={b.h} rx={3} className={highlightLast && i === s.bars.length - 1 ? 'fill-gold' : 'fill-teal'} />
        ),
      )}
    </svg>
  );
}
