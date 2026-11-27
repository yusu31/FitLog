'use client';

import { Moon } from 'lucide-react';
import Link from 'next/link';
import { LateTag } from '@/components/fitlog/late-tag';
import { summarize } from '@/components/me/records-list';
import { buttonClass } from '@/components/fitlog/thick-button';
import { useListRecords } from '@/lib/api/generated';
import { dayLabel, dayModeOfDate, selectableDates, withDay } from '@/lib/day-mode';
import type { CellStatus } from '@/lib/shared/week';

// その日のまとめ（02-9 PR 2 ⑧）。レポートのカレンダーで日を押すと開く。その日の記録（筋トレ・ラン・休み）を並べ、
// 各記録の詳細（動画・仲間の反応・コメントはそこにある）へつなぐ。今週の過ぎた日と今日には、その日の記録を足す入口も出す。
// 記録の無い日は責めない（休みの色の日は「記録のない日は、おやすみとして見せています」）
export function DaySummary({ date, status, today }: { date: string; status: CellStatus; today: string }) {
  const records = useListRecords({ date });
  const items = records.data?.status === 200 ? records.data.data.items : null;
  const noon = new Date(`${today}T12:00:00+09:00`);
  const canAdd = date <= today && selectableDates(noon).includes(date);
  const day = dayModeOfDate(date, noon);
  return (
    <section aria-labelledby="day-summary-title" data-testid="day-summary" className="mt-3 rounded-lg bg-canvas px-3 py-3">
      <h3 id="day-summary-title" className="text-sm font-extrabold">
        {dayLabel(date)}のまとめ
      </h3>
      {items === null ? (
        <p className="mt-1 text-sm font-bold text-fg-muted">{records.isError || records.data ? '読み込めませんでした' : '読み込み中…'}</p>
      ) : items.length === 0 ? (
        <p className="mt-1 text-sm font-bold text-fg-muted">{status === 'rest' ? '記録のない日は、おやすみとして見せています' : 'この日の記録はありません'}</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {items.map((r) => {
            const { title, detail } = summarize(r);
            return (
              <li key={r.id}>
                <Link
                  href={`/record-detail?id=${encodeURIComponent(r.id)}&from=me`}
                  className="flex min-h-11 items-center gap-2 rounded-fl bg-surface px-3 outline-none focus-visible:ring-4 focus-visible:ring-teal/40"
                >
                  {r.kind === 'rest' && <Moon aria-hidden className="size-4 shrink-0 text-grape-dark" />}
                  <span className="min-w-0 flex-1 truncate text-sm font-extrabold">{title}</span>
                  {r.late && <LateTag />}
                  {detail && <span className="shrink-0 text-note font-bold text-fg-subtle">{detail}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {canAdd && (
        <div className="mt-2 flex flex-wrap gap-2">
          <Link href={withDay('/exercises', day)} className={buttonClass({ variant: 'secondary' })}>
            筋トレを足す
          </Link>
          <Link href={withDay('/run', day)} className={buttonClass({ variant: 'secondary' })}>
            ランを足す
          </Link>
        </div>
      )}
    </section>
  );
}
