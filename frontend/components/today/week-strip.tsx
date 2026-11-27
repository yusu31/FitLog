import { Check, Moon } from 'lucide-react';
import { cn } from 'cn';
import type { WeekDay } from '@/lib/api/generated';
import { WEEKDAYS, formatMonthDay, weekdayIndex } from '@/lib/format';
import { addDays } from '@/lib/shared/week';

const STATUS_TEXT = { rec: '記録あり', rest: 'おやすみ', none: '' } as const;

// 週の帯（7マス。docs/screen-design.md 4章・prototype/v8 の .band）。月曜始まり。
// 記録=黄の丸に✓・休み=紫の丸に月・記録のない日と未来=薄い丸。色だけに頼らず形でも分かるので、文字の凡例は置かない（D2-1）。
// 連続日数は出さない・持たない。帯は濃いティール、文字は白（曜日の小さい字も 100%。D2-9）。
// selected は、いま記録しようとしている日。印はマスを囲む輪（三角だと丸と重なってドーム型に見えた。D2-3）。
// selectable の日（今日・きのう）だけ押せるボタンにして、押すとその日の記録に切り替わる（D2-2・D2-7）。
// ほかの日は押せない表示なので、厚み（影）を付けない（N-09）
export function WeekStrip({
  days,
  today,
  selected = today,
  selectable = [],
  onSelect,
}: {
  days: readonly WeekDay[];
  today: string;
  selected?: string;
  selectable?: readonly string[];
  onSelect?: (date: string) => void;
}) {
  return (
    <section aria-label="今週" className="bg-teal-dark pb-2 text-white">
      <p className="fl-num h-11 px-4 pt-2.5 text-[26px] leading-none short:h-7 short:pt-1 short:text-lg" aria-hidden>
        {Number(today.slice(5, 7))}月
      </p>
      <ol aria-label="今週の7日" className="flex h-[88px] px-1 short:h-[52px]">
        {days.map((day) => {
          const isToday = day.date === today;
          const isSelected = day.date === selected;
          const label = WEEKDAYS[weekdayIndex(day.date)];
          // 未来の日は、状態が何であっても薄い丸（まだ記録できない日）
          const status = day.date > today ? 'none' : day.status;
          const canSelect = onSelect !== undefined && selectable.includes(day.date);
          // きのうは、読み上げでも分かるように名前に入れる（今週のそれ以前の日は日付と曜日だけ）
          const dayWord = isToday ? '今日' : canSelect && day.date === addDays(today, -1) ? 'きのう' : '';
          const name = [`${formatMonthDay(day.date)} ${label}曜`, dayWord, STATUS_TEXT[status]].filter(Boolean).join(' ');
          const body = <DayCell label={label} date={day.date} status={status} isToday={isToday} />;
          const cellClass = cn(
            'flex h-full w-full flex-col items-center rounded-xl text-center',
            isSelected ? 'bg-surface/15 text-white ring-2 ring-white ring-inset' : 'text-white/85',
          );
          return (
            <li
              key={day.date}
              aria-label={canSelect ? undefined : name}
              aria-current={isToday ? 'date' : undefined}
              data-selected={isSelected ? 'true' : undefined}
              className="flex-1 px-0.5"
            >
              {canSelect ? (
                <button
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => onSelect?.(day.date)}
                  className={cn(cellClass, 'outline-none focus-visible:ring-4 focus-visible:ring-gold')}
                >
                  {/* 名前は隠し文字で持つ（aria-label にすると、見えている「金 20」と食い違う規則 label-content-name-mismatch に当たる） */}
                  <span data-testid="week-name" className="sr-only">
                    {name}
                  </span>
                  {body}
                </button>
              ) : (
                <div className={cellClass}>{body}</div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function DayCell({ label, date, status, isToday }: { label: string; date: string; status: 'rec' | 'rest' | 'none'; isToday: boolean }) {
  return (
    <>
      <span aria-hidden className="mt-1 block text-note font-bold text-white short:mt-0">
        {label}
      </span>
      <span aria-hidden data-testid="week-num" className="fl-num block text-[22px] leading-8 min-[360px]:text-[30px] short:text-lg short:leading-5 short:min-[360px]:text-lg">
        {Number(date.slice(8, 10))}
      </span>
      <span aria-hidden className="mt-0.5 flex h-[26px] items-center justify-center short:mt-0 short:h-4">
        <span
          data-testid="week-dot"
          data-status={status}
          className={cn(
            'flex size-[24px] items-center justify-center rounded-full short:size-4',
            status === 'rec' && 'bg-gold text-fg',
            status === 'rest' && 'bg-grape text-white',
            status === 'none' && 'bg-surface/15',
            isToday && 'border-[3px] border-surface',
          )}
        >
          {status === 'rec' && <Check className="size-3.5" strokeWidth={3.5} />}
          {status === 'rest' && <Moon className="size-3.5" strokeWidth={3} />}
        </span>
      </span>
    </>
  );
}
