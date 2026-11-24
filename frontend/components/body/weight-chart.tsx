'use client';

import { InfoTip } from '@/components/fitlog/info-tip';
import { useState } from 'react';
import { BODY_MESSAGES, PERIODS, chartShape, filterByPeriod, type ChartPoint, type Period } from '@/lib/body/body';
import { toLocalDate } from '@/lib/shared/local-date';

// 体重のグラフ。週・月・年で切り替える。7日平均の線が主役（太く）、日々の体重の点はうすく。縦軸は kg の上端・下端だけ小さく添える
export function WeightChart({ points }: { points: ChartPoint[] }) {
  const [period, setPeriod] = useState<Period>('month');
  const shown = filterByPeriod(points, period, toLocalDate(new Date()));
  return (
    <div className="space-y-2">
      <div role="group" aria-label={BODY_MESSAGES.periodLabel} className="flex gap-1">
        {PERIODS.map((p) => (
          <button
            key={p.value}
            type="button"
            aria-pressed={period === p.value}
            onClick={() => setPeriod(p.value)}
            className="min-h-11 flex-1 rounded-lg bg-line text-sm font-extrabold text-fg-muted outline-none focus-visible:ring-4 focus-visible:ring-teal/40 aria-pressed:bg-fg aria-pressed:text-surface"
          >
            {p.label}
          </button>
        ))}
      </div>
      <Chart points={points.length === 0 ? [] : shown} empty={points.length === 0 ? BODY_MESSAGES.chartEmpty : BODY_MESSAGES.chartEmptyPeriod} />
    </div>
  );
}

function Chart({ points, empty }: { points: ChartPoint[]; empty: string }) {
  const shape = chartShape(points);
  if (!shape) {
    return <p className="rounded-lg bg-canvas px-3 py-6 text-center text-sm font-bold text-fg-muted">{empty}</p>;
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
          <circle key={d.date} data-testid="weight-dot" cx={d.x} cy={d.y} r={3} className="fill-brand opacity-30" />
        ))}
        {shape.avgPath && <path data-testid="weight-avg-line" d={shape.avgPath} fill="none" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" className="stroke-brand" />}
        <text x={2} y={12} className="fill-fg-muted text-note">
          {shape.max}kg
        </text>
        <text x={2} y={shape.height - 4} className="fill-fg-muted text-note">
          {shape.min}kg
        </text>
      </svg>
      <figcaption>
        <InfoTip label="グラフの見方">{BODY_MESSAGES.chartHint}</InfoTip>
      </figcaption>
    </figure>
  );
}
