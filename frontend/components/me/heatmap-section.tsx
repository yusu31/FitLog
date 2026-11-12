'use client';

import { useGetHeatmap } from '@/lib/api/generated';
import { BODY_PART_LABEL } from '@/lib/body-parts';
import { HEAT_COLORS, HEAT_LEGEND, heatLevel, levelsOf } from '@/lib/heatmap';
import { toLocalDate } from '@/lib/shared/local-date';
import { BodyFigure } from './body-figure';

// 今週きたえたところ（F-12。docs/screen-design.md S-30）。今週（月曜〜今日）のセット数を部位ごとに色の濃さで見せる。
// 色だけに頼らないよう、部位ごとのセット数も文字で並べる
export function HeatmapSection() {
  const heatmap = useGetHeatmap({ weekStart: toLocalDate(new Date()) });
  const parts = heatmap.data?.status === 200 ? heatmap.data.data.parts : null;
  const total = parts?.reduce((sum, p) => sum + p.sets, 0) ?? 0;

  return (
    <section aria-labelledby="heat-heading" className="fl-slab px-4 py-3">
      <h2 id="heat-heading" className="text-sm font-extrabold text-sub-strong">
        今週きたえたところ
      </h2>
      {!parts ? (
        <p className="mt-2 rounded-lg bg-face px-3 py-6 text-center text-sm font-bold text-sub-strong">
          {heatmap.isError || heatmap.data ? '読み込めませんでした。電波の良い所で開き直してください' : '読み込み中…'}
        </p>
      ) : (
        <>
          <p className="mt-1 text-sm font-bold">
            <span className="fl-num text-3xl">{total}</span> セット
          </p>
          <div className="mt-2 flex justify-center gap-6 rounded-lg bg-white py-3 text-center text-xs text-sub-strong">
            <figure className="m-0">
              <BodyFigure view="front" levels={levelsOf(parts)} />
              前
            </figure>
            <figure className="m-0">
              <BodyFigure view="back" levels={levelsOf(parts)} />
              後ろ
            </figure>
          </div>
          <ul aria-label="部位ごとのセット数" className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            {parts.map((p) => (
              <li key={p.bodyPart} className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <i aria-hidden className="size-3 rounded-sm" style={{ background: HEAT_COLORS[heatLevel(p.sets)] }} />
                  {BODY_PART_LABEL[p.bodyPart]}
                </span>
                <span className="font-bold">{p.sets}セット</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 flex flex-wrap justify-center gap-3 text-xs text-sub-strong">
            {HEAT_LEGEND.map((l) => (
              <span key={l.level} className="flex items-center gap-1">
                <i aria-hidden className="size-3 rounded-sm" style={{ background: HEAT_COLORS[l.level] }} />
                {l.label}
              </span>
            ))}
          </p>
        </>
      )}
    </section>
  );
}
