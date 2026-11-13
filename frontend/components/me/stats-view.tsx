'use client';

import { cn } from 'cn';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { FullScreen } from '@/components/fitlog/full-screen';
import { useGetStats, type StatsResponse, type StatsWeek } from '@/lib/api/generated';
import { formatDistance, formatMonthDay } from '@/lib/format';
import { JAPAN_ROUTE, locateOnRoute, trekText } from '@/lib/japan-route';
import { STAMP_LABEL, STATS_VIEWS, barRatios, buildGrid, weightEquivalent, type StatsView } from '@/lib/stats';
import { toLocalDate } from '@/lib/shared/local-date';
import { useRequireSession } from '@/lib/use-require-session';

const STATUS_CLASS = { rec: 'bg-gold', rest: 'bg-grape', none: 'bg-line' } as const;
const STATUS_TEXT = { rec: '記録あり', rest: 'おやすみ', none: '' } as const;

// S-35 記録をくわしく（docs/screen-design.md 4章・F-22・F-26・F-27・F-29）。自分タブから入る。
// 週・月・年のマス／今月の数字／週ごとのグラフ／スタンプ帳。連続日数・目標線・「あと◯」は出さない。休みは全期間で同じ紫
export function StatsPage() {
  useRequireSession();
  const stats = useGetStats({ date: toLocalDate(new Date()) });
  const data = stats.data?.status === 200 ? stats.data.data : null;

  return (
    <FullScreen>
      <header className="flex items-center gap-1 px-2 pt-3">
        <Link
          href="/me"
          aria-label="自分へ戻る"
          className="flex size-11 items-center justify-center rounded-fl text-sub-strong outline-none focus-visible:ring-4 focus-visible:ring-teal/40"
        >
          <ChevronLeft aria-hidden className="size-7" />
        </Link>
        <h1 className="text-[28px] font-extrabold">記録をくわしく</h1>
      </header>
      <div className="space-y-4 px-4 pt-3 pb-10">
        {data ? (
          <>
            <Calendar data={data} />
            <MonthNumbers data={data} />
            <WeeklyChart title="週ごとの総重量" weeks={data.weekly} pick={(w) => w.totalWeightKg} format={(v) => `${v}kg`} />
            <WeeklyChart title="週ごとのラン" weeks={data.weekly} pick={(w) => w.runDistanceM} format={formatDistance} />
            <JapanTrek totalMeters={data.totalRunDistanceM} />
            <Stamps data={data} />
          </>
        ) : (
          <p className="rounded-lg bg-face px-3 py-6 text-center text-sm font-bold text-sub-strong">
            {stats.isError || stats.data ? '読み込めませんでした。電波の良い所で開き直してください' : '読み込み中…'}
          </p>
        )}
      </div>
    </FullScreen>
  );
}

function Calendar({ data }: { data: StatsResponse }) {
  const [view, setView] = useState<StatsView>('week');
  const cells = buildGrid(view, data.calendar, data.today);
  return (
    <section aria-labelledby="stats-cal" className="fl-slab px-4 py-3">
      <h2 id="stats-cal" className="text-sm font-extrabold text-sub-strong">
        記録のあしあと
      </h2>
      <div role="group" aria-label="期間" className="mt-2 flex gap-2">
        {STATS_VIEWS.map((v) => (
          <button
            key={v.view}
            type="button"
            aria-pressed={view === v.view}
            onClick={() => setView(v.view)}
            className={cn(
              'min-h-11 flex-1 rounded-fl border-2 text-sm font-extrabold outline-none focus-visible:ring-4 focus-visible:ring-teal/40',
              view === v.view ? 'border-teal-dark bg-teal-dark text-white' : 'border-teal-light bg-white text-teal-dark',
            )}
          >
            {v.label}
          </button>
        ))}
      </div>
      <ol
        aria-label={`${STATS_VIEWS.find((v) => v.view === view)!.label}のマス`}
        data-testid="stats-grid"
        className={cn('mt-3 grid gap-1', view === 'year' ? 'grid-flow-col grid-rows-7' : 'grid-cols-7')}
      >
        {cells.map((c, i) =>
          c.date === null ? (
            <li key={`blank-${i}`} aria-hidden />
          ) : (
            <li
              key={c.date}
              data-status={c.status}
              aria-label={[formatMonthDay(c.date), c.date === data.today ? '今日' : '', STATUS_TEXT[c.status]].filter(Boolean).join(' ')}
              className={cn('aspect-square', view === 'year' ? 'min-w-0 rounded-sm' : 'min-h-7 rounded-full', STATUS_CLASS[c.status], c.date === data.today && 'ring-2 ring-ink')}
            />
          ),
        )}
      </ol>
      <p className="mt-2 flex flex-wrap justify-center gap-3 text-xs text-sub-strong">
        {(['rec', 'rest', 'none'] as const).map((s) => (
          <span key={s} className="flex items-center gap-1">
            <i aria-hidden className={cn('size-3 rounded-full', STATUS_CLASS[s])} />
            {s === 'rec' ? '記録' : s === 'rest' ? 'おやすみ' : 'なし'}
          </span>
        ))}
      </p>
    </section>
  );
}

function MonthNumbers({ data }: { data: StatsResponse }) {
  const { month } = data;
  const equivalent = weightEquivalent(month.totalWeightKg);
  return (
    <section aria-labelledby="stats-month" className="fl-slab px-4 py-3">
      <h2 id="stats-month" className="text-sm font-extrabold text-sub-strong">
        {Number(month.month.slice(5))}月の数字
      </h2>
      <dl className="mt-2 grid grid-cols-2 gap-3 text-center">
        <Stat label="動いた日" value={month.activeDays} unit="日" />
        <Stat label="おやすみ" value={month.restDays} unit="日" />
        <Stat label="総重量" value={month.totalWeightKg} unit="kg" />
        <Stat label="ラン" value={Math.round(month.runDistanceM / 100) / 10} unit="km" />
      </dl>
      {equivalent && <p className="mt-2 text-center text-sm font-bold">{equivalent}</p>}
    </section>
  );
}

function Stat({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="rounded-lg bg-face py-2">
      <dt className="text-xs text-sub-strong">{label}</dt>
      <dd className="m-0">
        <span className="fl-num text-3xl">{value}</span> <span className="text-sm font-bold">{unit}</span>
      </dd>
    </div>
  );
}

function WeeklyChart({
  title,
  weeks,
  pick,
  format,
}: {
  title: string;
  weeks: readonly StatsWeek[];
  pick: (w: StatsWeek) => number;
  format: (v: number) => string;
}) {
  const values = weeks.map(pick);
  const ratios = barRatios(values);
  return (
    <section aria-label={title} className="fl-slab px-4 py-3">
      <h2 className="text-sm font-extrabold text-sub-strong">{title}（直近12週）</h2>
      <svg viewBox="0 0 240 80" role="img" aria-label={`${title}の棒グラフ`} className="mt-2 w-full">
        {ratios.map((r, i) => (
          <rect key={weeks[i].weekStart} x={i * 20 + 3} y={80 - r * 76} width={14} height={r * 76} rx={2} className={i === ratios.length - 1 ? 'fill-gold' : 'fill-teal'} />
        ))}
      </svg>
      <ul aria-label={`${title}の数字`} className="sr-only">
        {weeks.map((w) => (
          <li key={w.weekStart}>
            {formatMonthDay(w.weekStart)}の週 {format(pick(w))}
          </li>
        ))}
      </ul>
      <p className="text-center text-xs text-sub-strong">右が今週</p>
    </section>
  );
}

// 日本縦断（F-28）。ランの累計距離で、鹿児島から北へ進む略図。今いる場所だけを見せ、「あと◯km」は出さない。形と距離は目安
function JapanTrek({ totalMeters }: { totalMeters: number }) {
  const pos = locateOnRoute(totalMeters);
  const all = JAPAN_ROUTE.map((r) => `${r.x},${r.y}`).join(' ');
  const done = [...JAPAN_ROUTE.slice(0, pos.passed).map((r) => `${r.x},${r.y}`), `${pos.x},${pos.y}`].join(' ');
  return (
    <section aria-labelledby="stats-trek" className="fl-slab px-4 py-3">
      <h2 id="stats-trek" className="text-sm font-extrabold text-sub-strong">
        日本縦断
      </h2>
      <p className="mt-1 text-sm font-bold">{trekText(totalMeters, pos)}</p>
      <svg viewBox="0 0 220 300" role="img" aria-label={`走った距離ぶん、鹿児島から北へ進んだ位置。いまは${pos.name}のあたり`} className="mx-auto mt-2 h-72">
        <polyline points={all} fill="none" strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" className="stroke-line" />
        <polyline points={done} fill="none" strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" className="stroke-teal" />
        {JAPAN_ROUTE.map((r) => (
          <g key={r.name}>
            <circle cx={r.x} cy={r.y} r={3.5} strokeWidth={1.5} className="fill-white stroke-sub" />
            <text x={r.x + 10} y={r.y + 4} fontSize={11} fontWeight={700} className="fill-sub-strong">
              {r.name}
            </text>
          </g>
        ))}
        <circle cx={pos.x} cy={pos.y} r={8} strokeWidth={3} className="fill-gold stroke-white" />
      </svg>
      <p className="text-center text-[11px] font-bold text-sub-strong">形と距離は目安です</p>
    </section>
  );
}

function Stamps({ data }: { data: StatsResponse }) {
  return (
    <section aria-labelledby="stats-stamps" className="fl-slab px-4 py-3">
      <h2 id="stats-stamps" className="text-sm font-extrabold text-sub-strong">
        スタンプ帳
      </h2>
      <ul className="mt-2 grid grid-cols-3 gap-2">
        {data.stamps.map((s) => (
          <li
            key={s.key}
            data-earned={s.earned}
            className={cn('rounded-lg px-1 py-3 text-center text-xs font-extrabold', s.earned ? 'bg-gold-light text-ink' : 'bg-face text-sub')}
          >
            <span aria-hidden className="block text-xl">
              {s.earned ? '★' : '☆'}
            </span>
            {STAMP_LABEL[s.key]}
            <span className="sr-only">{s.earned ? '（獲得済み）' : '（まだ）'}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
