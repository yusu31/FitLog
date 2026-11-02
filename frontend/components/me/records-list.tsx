'use client';

import { Moon } from 'lucide-react';
import { useState } from 'react';
import { cn } from 'cn';
import { ThickButton } from '@/components/fitlog/thick-button';
import { useListRecords, type RecordDetailResponse } from '@/lib/api/generated';
import { formatDistance, formatDuration, formatMonthDay, WEEKDAYS, weekdayIndex } from '@/lib/format';

const PAGE_SIZE = '20';
const LOAD_ERROR = '読み込めませんでした。電波の良い所で開き直してください';

// 記録の一覧（新しい順・20件ずつ）。「もっと見る」で、前の応答の nextCursor を渡して続きを読む。
// 1ページ = 1つの部品にして、次のページの部品を下に足していく（先に読んだ分は TanStack Query が覚えているので消えない）
export function RecordsList() {
  return (
    <section aria-labelledby="records-heading">
      <h2 id="records-heading" className="mb-2 text-sm font-extrabold text-sub-strong">
        記録
      </h2>
      <ul aria-label="記録" className="space-y-2">
        <RecordsPage cursor={undefined} isFirst />
      </ul>
    </section>
  );
}

function RecordsPage({ cursor, isFirst = false }: { cursor: string | undefined; isFirst?: boolean }) {
  const { data, isPending, isError } = useListRecords({ limit: PAGE_SIZE, ...(cursor ? { cursor } : {}) });
  const [more, setMore] = useState(false);

  if (isPending) {
    return (
      <li aria-busy="true" aria-label="記録を読み込み中" className="h-16 animate-pulse rounded-fl bg-face" />
    );
  }
  if (isError || !data || data.status !== 200) {
    return (
      <li role="alert" className="rounded-fl bg-coral-light px-4 py-3 text-sm font-bold text-ink">
        {LOAD_ERROR}
      </li>
    );
  }
  const { items, nextCursor } = data.data;
  return (
    <>
      {isFirst && items.length === 0 && (
        <li className="fl-slab px-4 py-5 text-center text-sm font-bold text-sub-strong">まだ記録がありません</li>
      )}
      {items.map((record) => (
        <RecordRow key={record.id} record={record} />
      ))}
      {nextCursor &&
        (more ? (
          <RecordsPage cursor={nextCursor} />
        ) : (
          <li className="list-none pt-1">
            <ThickButton tone="white" size="sm" className="w-full" onClick={() => setMore(true)}>
              もっと見る
            </ThickButton>
          </li>
        ))}
    </>
  );
}

function RecordRow({ record }: { record: RecordDetailResponse }) {
  const { title, detail } = summarize(record);
  return (
    <li className="fl-slab flex min-h-16 items-center gap-3 px-3">
      <div className="w-[68px] shrink-0 leading-tight">
        <p className="fl-num text-xl text-ink">{formatMonthDay(record.localDate)}</p>
        <p className="text-[11px] font-bold text-sub">{WEEKDAYS[weekdayIndex(record.localDate)]}曜</p>
      </div>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate text-[15px] leading-tight font-extrabold">
          {record.kind === 'rest' && (
            <span
              aria-hidden
              className={cn('flex size-5 shrink-0 items-center justify-center rounded-full bg-grape-dark text-white')}
            >
              <Moon className="size-3" />
            </span>
          )}
          {title}
        </p>
        {detail && <p className="mt-0.5 text-xs font-bold text-sub">{detail}</p>}
      </div>
    </li>
  );
}

function summarize(record: RecordDetailResponse): { title: string; detail: string } {
  if (record.kind === 'rest') return { title: 'おやすみ', detail: '' };
  if (record.kind === 'run') {
    const run = record.run;
    return { title: 'ラン', detail: run ? `${formatDistance(run.distanceM)} ・ ${formatDuration(run.durationS)}` : '' };
  }
  const exercises = record.exercises ?? [];
  if (exercises.length === 0) return { title: '筋トレ', detail: '' };
  const sets = exercises.reduce((sum, e) => sum + e.sets.length, 0);
  const extra = exercises.length - 1;
  return { title: `${exercises[0].name}${extra > 0 ? ` ほか${extra}種目` : ''}`, detail: `${sets}セット` };
}
