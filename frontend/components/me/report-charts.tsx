'use client';

import { cn } from 'cn';
import { useState } from 'react';
import { BarChart } from '@/components/charts/bar-chart';
import { ChartFrame } from '@/components/charts/chart-frame';
import { LineChart } from '@/components/charts/line-chart';
import { useGetBody, useGetExerciseMaxWeights, useGetOneRepMax, type StatsResponse } from '@/lib/api/generated';
import { filterByPeriod } from '@/lib/body/body';
import { formatMonthDay } from '@/lib/format';
import { formatMetric, weeklySeries, type Metric } from '@/lib/stats';

type Chip = 'weight' | Metric | 'exercise';
const CHIPS: ReadonlyArray<{ key: Chip; label: string }> = [
  { key: 'weight', label: '体重' },
  { key: 'days', label: '動いた日' },
  { key: 'kg', label: '総重量' },
  { key: 'm', label: 'ラン' },
  { key: 'exercise', label: '種目' },
];
const BAR_TITLE: Record<Metric, string> = { days: '週ごとの動いた日', kg: '週ごとの総重量', m: '週ごとのラン' };

const emptyNote = (text: string) => <p className="rounded-lg bg-canvas px-3 py-6 text-center text-sm font-bold text-fg-muted">{text}</p>;

// レポートのグラフ（02-9 PR 1）。タイルの下に1枚の枠＋切替チップ。最初は総重量（筋トレの記録が無くランだけの人はラン）。
// 棒は直近12週（右が今週）。目標線・判定の言葉は出さない（F-27）
export function ReportCharts({ data }: { data: Pick<StatsResponse, 'calendar' | 'today'> }) {
  const weeks = weeklySeries(data.calendar, data.today, 12);
  const ranOnly = weeks.every((w) => w.workouts === 0) && weeks.some((w) => w.runs > 0);
  const [chip, setChip] = useState<Chip>(ranOnly ? 'm' : 'kg');

  return (
    <section aria-labelledby="stats-charts" className="fl-slab px-4 py-3">
      <h2 id="stats-charts" className="text-sm font-extrabold text-fg-muted">
        グラフ
      </h2>
      <div role="group" aria-label="見るグラフ" className="mt-2 flex flex-wrap gap-2">
        {CHIPS.map((c) => (
          <button
            key={c.key}
            type="button"
            aria-pressed={chip === c.key}
            onClick={() => setChip(c.key)}
            className={cn(
              'min-h-11 rounded-full border-2 px-4 text-sm font-extrabold outline-none focus-visible:ring-4 focus-visible:ring-teal/40',
              chip === c.key ? 'border-teal bg-teal-light text-brand' : 'border-teal-light bg-surface text-brand',
            )}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div className="mt-3" data-testid="report-chart">
        {chip === 'weight' ? <WeightLine today={data.today} /> : chip === 'exercise' ? <ExerciseLine /> : <Weekly metric={chip} weeks={weeks} />}
      </div>
    </section>
  );
}

function Weekly({ metric, weeks }: { metric: Metric; weeks: ReturnType<typeof weeklySeries> }) {
  const values = weeks.map((w) => w[metric]);
  const text = (v: number) => {
    const f = formatMetric(metric, v);
    return `${f.value}${f.unit}`;
  };
  const max = Math.max(...values);
  const caption = max === 0 ? 'この12週はまだありません' : `最大 ${text(max)}・右が今週 ${text(values[values.length - 1])}`;
  return (
    <ChartFrame
      summary={`${BAR_TITLE[metric]}（直近12週）。${caption}`}
      caption={caption}
      head={['週（月曜の日付）', BAR_TITLE[metric].replace('週ごとの', '')]}
      rows={weeks.map((w, i) => [formatMonthDay(w.weekStart) + '〜', text(values[i])])}
    >
      <BarChart values={values} />
    </ChartFrame>
  );
}

function WeightLine({ today }: { today: string }) {
  const body = useGetBody();
  const weights = body.data?.status === 200 ? body.data.data.weights : null;
  if (!weights) return emptyNote(body.isError || body.data ? '読み込めませんでした' : '読み込み中…');
  const shown = filterByPeriod(
    weights.map((p) => ({ date: p.date, kg: p.kg, avg7: p.avg7 })),
    'month',
    today,
  );
  if (shown.length === 0) return emptyNote('体重を入れると出ます（記録タブの「今日の体重」から入れられます）');
  const last = shown[shown.length - 1];
  return (
    <ChartFrame
      summary={`体重の折れ線（直近30日）。最新は ${last.date} の ${last.kg}kg`}
      caption={`直近30日・最新 ${last.kg}kg`}
      head={['日付', '体重']}
      rows={shown.map((p) => [formatMonthDay(p.date), `${p.kg}kg`])}
    >
      <LineChart points={shown.map((p) => ({ date: p.date, value: p.kg }))} unit="kg" />
    </ChartFrame>
  );
}

function ExerciseLine() {
  const oneRm = useGetOneRepMax();
  const items = oneRm.data?.status === 200 ? oneRm.data.data.items : null;
  const [picked, setPicked] = useState('');
  const exerciseId = picked || items?.[0]?.exerciseId || '';
  const series = useGetExerciseMaxWeights(exerciseId, { query: { enabled: exerciseId !== '' } });
  if (!items) return emptyNote(oneRm.isError || oneRm.data ? '読み込めませんでした' : '読み込み中…');
  if (items.length === 0) return emptyNote('筋トレの記録が付くと出ます');
  const points = series.data?.status === 200 ? series.data.data.points : null;
  return (
    <div className="space-y-2">
      <label className="block text-note font-extrabold text-fg-muted">
        種目
        <select
          value={exerciseId}
          onChange={(e) => setPicked(e.target.value)}
          className="mt-1 block min-h-11 w-full rounded-lg border-2 border-teal-light bg-surface px-2 text-sm font-bold text-fg outline-none focus-visible:ring-4 focus-visible:ring-teal/40"
        >
          {items.map((i) => (
            <option key={i.exerciseId} value={i.exerciseId}>
              {i.name}
            </option>
          ))}
        </select>
      </label>
      {!points ? (
        emptyNote(series.isError ? '読み込めませんでした' : '読み込み中…')
      ) : points.length === 0 ? (
        emptyNote('この種目は、重さのある記録がまだありません')
      ) : (
        <ChartFrame
          summary={`${series.data?.status === 200 ? series.data.data.name : ''}の最大重量の推移。最新は ${points[points.length - 1].date} の ${points[points.length - 1].kg}kg`}
          caption="その日の最大重量"
          head={['日付', '最大重量']}
          rows={points.map((p) => [p.date.slice(2), `${p.kg}kg`])}
        >
          <LineChart points={points.map((p) => ({ date: p.date, value: p.kg }))} unit="kg" />
        </ChartFrame>
      )}
    </div>
  );
}
