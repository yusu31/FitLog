'use client';

import { cn } from 'cn';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { FullScreen } from '@/components/fitlog/full-screen';
import { JapanMap } from '@/components/me/japan-map';
import { useGetStats, type StatsCalendarDay, type StatsResponse } from '@/lib/api/generated';
import { formatMonthDay } from '@/lib/format';
import { locateOnRoute, nextText, trekText } from '@/lib/japan-route';
import {
  METRICS,
  STAMP_LABEL,
  STATS_VIEWS,
  formatMetric,
  minMonthOffset,
  minWeekOffset,
  monthGrid,
  monthRange,
  sumRange,
  tileWindowStart,
  weekRange,
  weightEquivalent,
  yearHeat,
  type GridCell,
  type Metric,
  type StatsView,
} from '@/lib/stats';
import { toLocalDate } from '@/lib/shared/local-date';
import { useRequireSession } from '@/lib/use-require-session';

const STATUS_CLASS = { rec: 'bg-gold', rest: 'bg-grape', none: 'bg-canvas' } as const;
// 月曜始まり（マスの並びと同じ。A08-4）
const WEEKDAY_HEAD = ['月', '火', '水', '木', '金', '土', '日'] as const;
const STATUS_TEXT = { rec: '記録あり', rest: 'おやすみ', none: '' } as const;
const segClass = (on: boolean) =>
  cn(
    'min-h-11 flex-1 rounded-fl border-2 text-sm font-extrabold outline-none focus-visible:ring-4 focus-visible:ring-teal/40',
    on ? 'border-teal-dark bg-teal-dark text-white' : 'border-teal-light bg-surface text-brand',
  );

// S-35 記録のまとめ（F-22・F-26・F-27・F-29。D5）。自分タブから入る。
// 週・月・年の切替＋◀▶／合計4つ／数字のタイルを並べて比べる／スタンプ帳。連続日数・目標線・「あと◯」は出さない。休みは全期間で同じ紫
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
          className="flex size-11 items-center justify-center rounded-fl text-fg-muted outline-none focus-visible:ring-4 focus-visible:ring-teal/40"
        >
          <ChevronLeft aria-hidden className="size-7" />
        </Link>
        <h1 className="text-page-title font-extrabold">記録のまとめ</h1>
      </header>
      <div className="space-y-4 px-4 pt-3 pb-10">
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
    </FullScreen>
  );
}

type Tile = { off: number; label: string; value: number; selected: boolean };

// 期間の切替・◀▶・合計・タイル。年は1年分（calendar の365日）で◀▶は無い。年のタイルを押すと、その月へ移る
function Period({ data }: { data: StatsResponse }) {
  const { today, calendar } = data;
  const [view, setView] = useState<StatsView>('week');
  const [off, setOff] = useState(0);
  const [metric, setMetric] = useState<Metric>('days');
  const first = calendar[0].date;
  const min = view === 'week' ? minWeekOffset(today, first) : view === 'month' ? minMonthOffset(today, first) : 0;

  const range = view === 'week' ? weekRange(today, off) : view === 'month' ? monthRange(today, off) : { from: first, to: today };
  const totals = sumRange(calendar, range.from, range.to > today ? today : range.to);
  const title =
    view === 'week'
      ? `${formatMonthDay(range.from)}〜${formatMonthDay(range.to)}`
      : view === 'month'
        ? `${Number(range.from.slice(0, 4))}年${Number(range.from.slice(5, 7))}月`
        : `この1年（${formatMonthDay(first)}〜${formatMonthDay(today)}）`;

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
    const start = view === 'month' ? tileWindowStart(off, min) : -11;
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
          {view === 'year' ? <span className="size-11" /> : <NavButton label="前へ" disabled={off <= min} onClick={() => setOff(off - 1)} dir="prev" />}
          <p data-testid="stats-title" className="text-center font-extrabold">
            {title}
          </p>
          {view === 'year' ? <span className="size-11" /> : <NavButton label="次へ" disabled={off >= 0} onClick={() => setOff(off + 1)} dir="next" />}
        </div>
        <dl data-testid="stats-totals" className="mt-2 grid grid-cols-4 gap-1 text-center">
          <Stat label="動いた日" value={String(totals.days)} unit="日" />
          <Stat label="おやすみ" value={String(totals.rest)} unit="日" />
          <Stat label="総重量" {...formatMetric('kg', totals.kg)} />
          <Stat label="ラン" {...formatMetric('m', totals.m)} />
        </dl>
        {equivalent && <p className="mt-2 text-center text-sm font-bold">{equivalent}</p>}
        {view === 'month' && <MonthCalendar cells={monthGrid(calendar, today, off)} today={today} />}
        {view === 'year' && <YearHeat calendar={calendar} today={today} />}
      </section>

      <section aria-labelledby="stats-tiles" className="fl-slab px-4 py-3">
        <h2 id="stats-tiles" className="text-sm font-extrabold text-fg-muted">
          {view === 'week' ? '週' : '月'}ごとの{METRICS.find((m) => m.key === metric)!.label}
        </h2>
        <div role="group" aria-label="見る数字" className="mt-2 flex gap-2">
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
        <ul data-testid="stats-tiles" className="mt-3 grid grid-cols-6 gap-1.5">
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
      {metric === 'm' && <JapanTrek totalMeters={data.totalRunDistanceM} />}
    </>
  );
}

function NavButton({ label, disabled, onClick, dir }: { label: string; disabled: boolean; onClick: () => void; dir: 'prev' | 'next' }) {
  const Icon = dir === 'prev' ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-11 items-center justify-center rounded-full border-2 border-teal-light text-brand outline-none focus-visible:ring-4 focus-visible:ring-teal/40 disabled:opacity-35"
    >
      <Icon aria-hidden className="size-5" />
    </button>
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

// 月のカレンダー（日付つき・月曜始まり）。休みは全期間で同じ紫
function MonthCalendar({ cells, today }: { cells: GridCell[]; today: string }) {
  return (
    <div className="mt-3">
      <p aria-hidden data-testid="stats-weekdays" className="grid grid-cols-7 gap-1 text-center text-note font-bold text-fg-muted">
        {WEEKDAY_HEAD.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </p>
      <ol aria-label="月のマス" data-testid="stats-grid" className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((c, i) =>
          c.date === null ? (
            <li key={`blank-${i}`} aria-hidden />
          ) : (
            <li
              key={c.date}
              data-status={c.status}
              aria-label={[formatMonthDay(c.date), c.date === today ? '今日' : '', STATUS_TEXT[c.status]].filter(Boolean).join(' ')}
              className={cn('fl-num flex aspect-square items-center justify-center rounded-full text-sm', STATUS_CLASS[c.status], c.status === 'none' && 'text-fg-muted', c.date === today && 'ring-2 ring-fg')}
            >
              {Number(c.date.slice(8))}
            </li>
          ),
        )}
      </ol>
    </div>
  );
}

// 年の色のマス。半年ずつ2段・月の見出し。たては上から月〜日、よこは左から右へ週が進む
function YearHeat({ calendar, today }: { calendar: readonly StatsCalendarDay[]; today: string }) {
  const halves = yearHeat(calendar);
  return (
    <div className="mt-3 space-y-1">
      <p data-testid="stats-weekdays" className="text-note font-bold text-fg-muted">
        たては上から月〜日、よこは左から右へ週が進みます
      </p>
      {halves.map((h, hi) => (
        <div key={hi}>
          <div aria-hidden className="grid h-3 text-[0.58rem] font-extrabold text-fg-muted" style={{ gridTemplateColumns: `repeat(${h.cols}, 1fr)` }}>
            {h.labels.map((l) => (
              <span key={l.col} className="whitespace-nowrap" style={{ gridColumn: l.col }}>
                {l.text}
              </span>
            ))}
          </div>
          <ol aria-label={hi === 0 ? '年のマス（前半）' : '年のマス（後半）'} data-testid="stats-grid" className="mt-0.5 grid grid-flow-col grid-rows-7 gap-0.5" style={{ gridTemplateColumns: `repeat(${h.cols}, 1fr)` }}>
            {h.cells.map((c, i) =>
              c === null || c.date === null ? (
                <li key={`b${i}`} aria-hidden />
              ) : (
                <li
                  key={c.date}
                  data-status={c.status}
                  aria-label={[formatMonthDay(c.date), c.date === today ? '今日' : '', STATUS_TEXT[c.status]].filter(Boolean).join(' ')}
                  className={cn('aspect-square min-w-0 rounded-sm', c.status === 'none' ? 'bg-line' : STATUS_CLASS[c.status], c.date === today && 'ring-2 ring-fg')}
                />
              ),
            )}
          </ol>
        </div>
      ))}
    </div>
  );
}

// 日本縦断（F-28）。ランの累計距離で、鹿児島から北へ進む本物の地図。今いる場所だけを見せ、「あと◯km」は出さない。形と距離は目安
function JapanTrek({ totalMeters }: { totalMeters: number }) {
  const pos = locateOnRoute(totalMeters);
  return (
    <section aria-labelledby="stats-trek" className="fl-slab px-4 py-3">
      <h2 id="stats-trek" className="text-sm font-extrabold text-fg-muted">
        日本縦断
      </h2>
      <p className="mt-1 text-center" data-testid="trek-total">
        <span className="text-note text-fg-muted">これまでの合計</span> <span className="fl-num text-3xl">{(totalMeters / 1000).toFixed(1)}</span> <span className="text-sm font-bold">km</span>
      </p>
      <p className="mt-1 text-sm font-bold">{trekText(totalMeters, pos)}</p>
      <p className="text-sm font-bold text-brand">{nextText(pos)}</p>
      <JapanMap pos={pos} />
      <p className="text-center text-note font-bold text-fg-muted">形と距離は目安です</p>
    </section>
  );
}

// 「2026-11-03」→「11/3」（取得日の表示。U10）
function shortDate(date: string): string {
  const [, m, d] = date.split('-');
  return `${Number(m)}/${Number(d)}`;
}

function Stamps({ data }: { data: StatsResponse }) {
  return (
    <section aria-labelledby="stats-stamps" className="fl-slab px-4 py-3">
      <h2 id="stats-stamps" className="text-sm font-extrabold text-fg-muted">
        スタンプ帳
      </h2>
      <ul className="mt-2 grid grid-cols-3 gap-2">
        {data.stamps.map((s) => (
          <li
            key={s.key}
            data-earned={s.earned}
            className={cn('rounded-lg px-1 py-3 text-center text-note font-extrabold', s.earned ? 'bg-gold-light text-fg' : 'bg-canvas text-fg-muted')}
          >
            <span aria-hidden className="block text-xl">
              {s.earned ? '★' : '○'}
            </span>
            {STAMP_LABEL[s.key]}
            {s.earnedAt && <span className="mt-0.5 block text-note font-bold text-fg-muted">{shortDate(s.earnedAt)}</span>}
            <span className="sr-only">{s.earned ? '（獲得済み）' : '（まだ）'}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
