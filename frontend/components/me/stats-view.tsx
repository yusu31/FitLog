'use client';

import { ThickButton } from '@/components/fitlog/thick-button';
import { cn } from 'cn';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { JapanMap } from '@/components/me/japan-map';
import { StampMedal } from '@/components/me/stamp-medal';
import { HeatmapSection } from '@/components/me/heatmap-section';
import { ReportCharts } from '@/components/me/report-charts';
import { WeekRunSection } from '@/components/me/week-run-section';
import { useGetStats, type StatsResponse } from '@/lib/api/generated';
import { formatMonthDay } from '@/lib/format';
import { locateOnRoute, nextText, trekText } from '@/lib/japan-route';
import {
  METRICS,
  STAMP_LABEL,
  recentStamps,
  STATS_VIEWS,
  formatMetric,
  minMonthOffset,
  minWeekOffset,
  minYearOffset,
  monthGrid,
  monthRange,
  sumRange,
  tileWindowStart,
  weekGrid,
  weekRange,
  weightEquivalent,
  yearMonths,
  type GridCell,
  type Metric,
  type StatsView,
} from '@/lib/stats';
import { toLocalDate } from '@/lib/shared/local-date';
import { useRequireSession } from '@/lib/use-require-session';
import { InfoTip } from '@/components/fitlog/info-tip';

const STATUS_CLASS = { rec: 'bg-gold', rest: 'bg-grape', none: 'bg-canvas' } as const;
// 月曜始まり（マスの並びと同じ。A08-4）
const WEEKDAY_HEAD = ['月', '火', '水', '木', '金', '土', '日'] as const;
const STATUS_TEXT = { rec: '記録あり', rest: 'おやすみ', none: '' } as const;
const segClass = (on: boolean) =>
  cn(
    'min-h-11 flex-1 rounded-fl border-2 text-sm font-extrabold outline-none focus-visible:ring-4 focus-visible:ring-teal/40',
    on ? 'border-teal-dark bg-teal-dark text-white' : 'border-teal-light bg-surface text-brand',
  );

// S-35 レポート（旧「記録のまとめ」。F-22・F-26・F-27・F-29。D5）。自分タブの先頭（/me）。タブ付き（page 側で AppShell と MeFrame に包む）にして「＜」は置かない。
// 週・月・年の切替＋◀▶／合計4つ／数字のタイルを並べて比べる／スタンプ帳。連続日数・目標線・「あと◯」は出さない。休みは全期間で同じ紫
export function StatsPage() {
  useRequireSession();
  const stats = useGetStats({ date: toLocalDate(new Date()) });
  const data = stats.data?.status === 200 ? stats.data.data : null;

  return (
    <>
      <div className="space-y-4">
        {data ? (
          <>
            <Period data={data} />
            <Stamps data={data} />
          </>
        ) : (
          <p className="rounded-lg bg-canvas px-3 py-6 text-center text-sm font-bold text-fg-muted">
            {stats.isError || stats.data ? '読み込めませんでした。電波の良い所で開き直してください' : '読み込み中…'}
          </p>
        )}
      </div>
    </>
  );
}

type Tile = { off: number; label: string; value: number; selected: boolean };

// 期間の切替・◀▶・合計・タイル。週は7マスの帯・月はカレンダー・年は月ごとの小さなカレンダー12個（どれも同じマス部品 DayCell。D5-2）。◀▶は週・月・年とも（年は1か月ずつ）。年のタイルを押すと、その月へ移る
function Period({ data }: { data: StatsResponse }) {
  const { today, calendar } = data;
  const [view, setView] = useState<StatsView>('week');
  const [off, setOff] = useState(0);
  // 「日本地図で見る」から来たとき（?metric=m）は、最初からランを選んで地図を描く（L6・D4-4）。指定が無い・不正なら「動いた日」
  const requested = useSearchParams()?.get('metric');
  const [metric, setMetric] = useState<Metric>(METRICS.some((m) => m.key === requested) ? (requested as Metric) : 'days');
  const first = calendar[0].date;
  const min = view === 'week' ? minWeekOffset(today, first) : view === 'month' ? minMonthOffset(today, first) : minYearOffset(today, first);

  const yearFrom = monthRange(today, off - 11);
  const yearTo = monthRange(today, off);
  const range = view === 'week' ? weekRange(today, off) : view === 'month' ? monthRange(today, off) : { from: yearFrom.from, to: yearTo.to };
  const totals = sumRange(calendar, range.from, range.to > today ? today : range.to);
  const title =
    view === 'week'
      ? `${formatMonthDay(range.from)}〜${formatMonthDay(range.to)}`
      : view === 'month'
        ? `${Number(range.from.slice(0, 4))}年${Number(range.from.slice(5, 7))}月`
        : `${Number(yearFrom.ym.slice(0, 4))}年${Number(yearFrom.ym.slice(5))}月〜${Number(yearTo.ym.slice(0, 4))}年${Number(yearTo.ym.slice(5))}月`;

  // 横に並べる数字のタイル（週は6週・月は6か月・年は12か月）
  let tiles: Tile[];
  if (view === 'week') {
    const start = tileWindowStart(off, min);
    tiles = Array.from({ length: 6 }, (_, i) => {
      const o = start + i;
      const r = weekRange(today, o);
      return { off: o, label: `${formatMonthDay(r.from)}〜`, value: sumRange(calendar, r.from, r.to)[metric], selected: o === off };
    });
  } else {
    const count = view === 'month' ? 6 : 12;
    const start = view === 'month' ? tileWindowStart(off, min) : off - 11;
    tiles = Array.from({ length: count }, (_, i) => {
      const o = start + i;
      const r = monthRange(today, o);
      return { off: o, label: `${Number(r.ym.slice(5))}月`, value: sumRange(calendar, r.from, r.to)[metric], selected: view === 'month' && o === off };
    });
  }
  const max = Math.max(1, ...tiles.map((t) => t.value));
  const equivalent = weightEquivalent(totals.kg);

  return (
    <>
      <section aria-labelledby="stats-period" className="fl-slab px-4 py-3">
        <h2 id="stats-period" className="sr-only">
          期間ごとの記録
        </h2>
        <div role="group" aria-label="期間" className="flex gap-2">
          {STATS_VIEWS.map((v) => (
            <button
              key={v.view}
              type="button"
              aria-pressed={view === v.view}
              onClick={() => {
                setView(v.view);
                setOff(0);
              }}
              className={segClass(view === v.view)}
            >
              {v.label}
            </button>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between">
          <NavButton label="前へ" disabled={off <= min} onClick={() => setOff(off - 1)} dir="prev" />
          <p data-testid="stats-title" className="min-w-0 flex-1 px-1 text-center font-extrabold">
            {title}
          </p>
          <NavButton label="次へ" disabled={off >= 0} onClick={() => setOff(off + 1)} dir="next" />
        </div>
        <dl data-testid="stats-totals" className="mt-2 grid grid-cols-2 gap-1 text-center min-[260px]:grid-cols-4">
          <Stat label="動いた日" value={String(totals.days)} unit="日" />
          <Stat label="おやすみ" value={String(totals.rest)} unit="日" />
          <Stat label="総重量" {...formatMetric('kg', totals.kg)} />
          <Stat label="ラン" {...formatMetric('m', totals.m)} />
        </dl>
        {equivalent && <p className="mt-2 text-center text-sm font-bold">{equivalent}</p>}
        {view === 'week' && <WeekBand cells={weekGrid(calendar, today, off)} today={today} />}
        {view === 'month' && <MonthCalendar cells={monthGrid(calendar, today, off)} today={today} />}
        {view === 'year' && <YearCalendars months={yearMonths(calendar, today, off)} today={today} />}
        <CountBand totals={totals} />
      </section>

      <section aria-labelledby="stats-tiles" className="fl-slab px-4 py-3">
        <h2 id="stats-tiles" className="text-sm font-extrabold text-fg-muted">
          {view === 'week' ? '週' : '月'}ごとの{METRICS.find((m) => m.key === metric)!.label}
        </h2>
        <div role="group" aria-label="見る数字" className="mt-2 flex flex-wrap gap-2">
          {METRICS.map((m) => (
            <button
              key={m.key}
              type="button"
              aria-pressed={metric === m.key}
              onClick={() => setMetric(m.key)}
              className={cn(
                'min-h-11 rounded-full border-2 px-4 text-sm font-extrabold outline-none focus-visible:ring-4 focus-visible:ring-teal/40',
                metric === m.key ? 'border-teal bg-teal-light text-brand' : 'border-teal-light bg-surface text-brand',
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
        <ul data-testid="stats-tiles" className="mt-3 grid grid-cols-3 gap-1.5 min-[260px]:grid-cols-6">
          {tiles.map((t) => {
            const f = formatMetric(metric, t.value);
            return (
              <li key={t.off} className="min-w-0">
                <button
                  type="button"
                  aria-pressed={t.selected}
                  aria-label={`${t.label} ${f.value}${f.unit}`}
                  onClick={() => {
                    if (view === 'year') setView('month');
                    setOff(t.off);
                  }}
                  className={cn(
                    'relative flex min-h-14 w-full flex-col items-center overflow-hidden rounded-xl px-0.5 pt-1.5 pb-2 outline-none focus-visible:ring-4 focus-visible:ring-teal/40',
                    t.selected ? 'bg-gold-light' : 'bg-canvas',
                  )}
                >
                  <span className="whitespace-nowrap text-[0.6rem] font-extrabold text-fg-muted">{t.label}</span>
                  <span className="fl-num text-lg leading-tight">
                    {f.value}
                    <small className="text-[0.6em]">{f.unit}</small>
                  </span>
                  <i aria-hidden className={cn('absolute bottom-0 left-0 h-[3px] rounded-r', t.selected ? 'bg-gold' : 'bg-teal')} style={{ width: `${Math.round((t.value / max) * 100)}%` }} />
                </button>
              </li>
            );
          })}
        </ul>
      </section>
      <ReportCharts data={data} />
      {/* 週を開いている間、今週の分だけ（今週のラン・今週きたえたところ） */}
      {view === 'week' && off === 0 && (
        <>
          <WeekRunSection />
          <HeatmapSection />
        </>
      )}
      <JapanTrek totalMeters={data.totalRunDistanceM} defaultOpen={requested === 'm'} />
    </>
  );
}

// カレンダーの下の回数の帯（M1）。選んでいる期間の実施回数（筋トレ＋ラン）と、その内訳。共有・絞り込みはしない
function CountBand({ totals }: { totals: ReturnType<typeof sumRange> }) {
  const count = totals.workouts + totals.runs;
  return (
    <div data-testid="stats-count" className="mt-3 rounded-lg bg-canvas px-3 py-2 text-center">
      <p className="text-note font-extrabold text-fg-muted">この期間にやった回数</p>
      <p>
        <span className="fl-num text-3xl">{count}</span>
        <small className="text-sm font-bold">回</small>
      </p>
      <p data-testid="stats-breakdown" className="text-note font-bold text-fg-muted">
        筋トレ {totals.workouts}回・ラン {totals.runs}回・休み {totals.rest}日
      </p>
    </div>
  );
}

function NavButton({ label, disabled, onClick, dir }: { label: string; disabled: boolean; onClick: () => void; dir: 'prev' | 'next' }) {
  const Icon = dir === 'prev' ? ChevronLeft : ChevronRight;
  return (
    <ThickButton variant="icon" className="shrink-0 border-2 border-teal-light text-brand disabled:opacity-35" aria-label={label} disabled={disabled} onClick={onClick}>
      <Icon aria-hidden className="size-5" />
    </ThickButton>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="flex flex-col-reverse">
      <dt className="text-[0.65rem] font-extrabold text-fg-muted">{label}</dt>
      <dd className="m-0">
        <span className="fl-num text-2xl">{value}</span>
        <small className="text-[0.65em] font-bold">{unit}</small>
      </dd>
    </div>
  );
}

// 1日のマス。週・月・年で同じ部品（D5-2）。休みは全期間で同じ紫。年は日付の数字なし（色だけ）
function DayCell({ cell, today, small = false }: { cell: GridCell; today: string; small?: boolean }) {
  const date = cell.date!;
  return (
    <li
      data-status={cell.status}
      aria-label={[formatMonthDay(date), date === today ? '今日' : '', STATUS_TEXT[cell.status]].filter(Boolean).join(' ')}
      className={cn(
        'flex aspect-square items-center justify-center rounded-full',
        small ? 'min-w-0' : 'fl-num text-sm',
        STATUS_CLASS[cell.status],
        !small && cell.status === 'none' && 'text-fg-muted',
        date === today && (small ? 'ring-1 ring-fg' : 'ring-2 ring-fg'),
      )}
    >
      {small ? null : Number(date.slice(8))}
    </li>
  );
}

// 月曜始まりの曜日の見出し
function WeekdayHead() {
  return (
    <p aria-hidden data-testid="stats-weekdays" className="grid grid-cols-7 gap-1 text-center text-note font-bold text-fg-muted">
      {WEEKDAY_HEAD.map((w) => (
        <span key={w}>{w}</span>
      ))}
    </p>
  );
}

// 週の帯（7マス）
function WeekBand({ cells, today }: { cells: GridCell[]; today: string }) {
  return (
    <div className="mt-3">
      <WeekdayHead />
      <ol aria-label="週のマス" data-testid="stats-grid" className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((c) => (
          <DayCell key={c.date} cell={c} today={today} />
        ))}
      </ol>
    </div>
  );
}

// 月のカレンダー（日付つき・月曜始まり）
function MonthCalendar({ cells, today }: { cells: GridCell[]; today: string }) {
  return (
    <div className="mt-3">
      <WeekdayHead />
      <ol aria-label="月のマス" data-testid="stats-grid" className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((c, i) => (c.date === null ? <li key={`blank-${i}`} aria-hidden /> : <DayCell key={c.date} cell={c} today={today} />))}
      </ol>
    </div>
  );
}

// 年: 月ごとの小さなカレンダー12個（3列×4段。日付の数字なし・色だけ）。見出しは月
function YearCalendars({ months, today }: { months: ReturnType<typeof yearMonths>; today: string }) {
  return (
    <ul aria-label="年のカレンダー" data-testid="stats-year" className="mt-3 grid grid-cols-3 gap-x-3 gap-y-3">
      {months.map((m) => (
        <li key={m.ym} data-testid="stats-year-month">
          <p className="mb-1 text-note font-extrabold text-fg-muted">{m.label}</p>
          <ol aria-label={`${m.label}のマス`} data-testid="stats-grid" className="grid grid-cols-7 gap-0.5">
            {m.cells.map((c, i) => (c.date === null ? <li key={`blank-${i}`} aria-hidden /> : <DayCell key={c.date} cell={c} today={today} small />))}
          </ol>
        </li>
      ))}
    </ul>
  );
}

// 日本縦断（F-28）。ランの累計距離で、鹿児島から北へ進む本物の地図。今いる場所だけを見せ、「あと◯km」は出さない。形と距離は目安。
// 帯はいつも出し、押すと開く（#439。ランの数字を選んだときだけ出していて見つからなかった）。地図は重いので、開いたときだけ読む
function JapanTrek({ totalMeters, defaultOpen }: { totalMeters: number; defaultOpen: boolean }) {
  const pos = locateOnRoute(totalMeters);
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section aria-labelledby="stats-trek" className="fl-slab px-4 py-3">
      <h2 id="stats-trek">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="flex min-h-11 w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-lg text-left outline-none focus-visible:ring-4 focus-visible:ring-teal/40"
        >
          <span className="min-w-[8rem] flex-1">
            <span className="block text-sm font-extrabold text-fg-muted">日本縦断</span>
            <span className="block text-sm font-bold">
              いま{pos.name}のあたり <span className="inline-block text-brand">{nextText(pos)}</span>
            </span>
          </span>
          <span className="shrink-0 text-note font-extrabold text-brand">{open ? 'とじる' : '地図を見る'}</span>
          <ChevronDown aria-hidden className={cn('size-5 shrink-0 text-brand', open && 'rotate-180')} />
        </button>
      </h2>
      {open && <TrekDetail totalMeters={totalMeters} pos={pos} />}
    </section>
  );
}

function TrekDetail({ totalMeters, pos }: { totalMeters: number; pos: ReturnType<typeof locateOnRoute> }) {
  return (
    <>
      <InfoTip label="日本縦断の説明">走った距離で、日本を南の鹿児島から北の稚内へ進みます</InfoTip>
      <p className="mt-1 text-center" data-testid="trek-total">
        <span className="text-note text-fg-muted">これまでの合計</span> <span className="fl-num text-3xl">{(totalMeters / 1000).toFixed(1)}</span> <span className="text-sm font-bold">km</span>
      </p>
      <p className="mt-1 text-sm font-bold">{trekText(totalMeters, pos)}</p>
      <JapanMap pos={pos} />
      <p className="text-center text-note font-bold text-fg-muted">形と距離は目安です</p>
    </>
  );
}

// 「2026-11-03」→「11/3」（取得日の表示。U10）
function shortDate(date: string): string {
  const [, m, d] = date.split('-');
  return `${Number(m)}/${Number(d)}`;
}

function Stamps({ data }: { data: StatsResponse }) {
  const recent = recentStamps(data.stamps);
  return (
    <section aria-labelledby="stats-stamps" className="fl-slab px-4 py-3">
      <h2 id="stats-stamps" className="text-sm font-extrabold text-fg-muted">
        スタンプ帳
      </h2>
      {recent.length > 0 && (
        <div data-testid="recent-stamps" className="mt-2 rounded-lg bg-canvas px-2 py-2">
          <p className="text-note font-extrabold text-fg-muted">最近とった</p>
          <ul className="mt-1 grid grid-cols-2 gap-1 min-[260px]:grid-cols-4">
            {recent.map((s) => (
              <li key={s.key} className="flex min-w-0 flex-col items-center text-center text-note font-extrabold">
                <StampMedal stampKey={s.key} earned size={44} />
                <span>{STAMP_LABEL[s.key]}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <ul data-testid="all-stamps" className="mt-2 grid grid-cols-2 gap-2 min-[260px]:grid-cols-3">
        {data.stamps.map((s) => (
          <li
            key={s.key}
            data-earned={s.earned}
            className={cn('flex flex-col items-center rounded-lg px-1 py-2 text-center text-note font-extrabold', s.earned ? 'bg-gold-light text-fg' : 'bg-canvas text-fg-muted')}
          >
            <StampMedal stampKey={s.key} earned={s.earned} />
            {STAMP_LABEL[s.key]}
            {s.earnedAt && <span className="mt-0.5 block text-note font-bold text-fg-muted">{shortDate(s.earnedAt)}</span>}
            <span className="sr-only">{s.earned ? '（獲得済み）' : '（まだ）'}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
