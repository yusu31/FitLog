import { cn } from 'cn';
import type { WeekDay } from '@/lib/api/generated';
import { WEEKDAYS, formatMonthDay, weekdayIndex } from '@/lib/format';

const STATUS_TEXT = { rec: '記録あり', rest: 'おやすみ', none: '' } as const;

// 週の帯（7マス。docs/screen-design.md 4章・prototype/v8 の .band）。月曜始まり。
// 記録=黄の丸・休み=紫の丸・記録のない日と未来=薄い丸。連続日数は出さない・持たない。
// 帯は濃いティール、文字は白 80%（6章のコントラスト比の実測。数字は 30px の大きい文字）。
// selected は、いま記録しようとしている日（きのうを選ぶと、その日に印が移る。A02-7）。
// 丸は押せない表示なので、厚み（影）を付けない（N-09）。凡例を1行添える（A02-6）
export function WeekStrip({ days, today, selected = today }: { days: readonly WeekDay[]; today: string; selected?: string }) {
  return (
    <section aria-label="今週" className="bg-teal-dark text-white">
      <p className="fl-num h-11 px-4 pt-2.5 text-[26px] leading-none" aria-hidden>
        {Number(today.slice(5, 7))}月
      </p>
      <ol aria-label="今週の7日" className="flex h-[84px]">
        {days.map((day) => {
          const isToday = day.date === today;
          const isSelected = day.date === selected;
          const label = WEEKDAYS[weekdayIndex(day.date)];
          // 未来の日は、状態が何であっても薄い丸（まだ記録できない日）
          const status = day.date > today ? 'none' : day.status;
          const name = [`${formatMonthDay(day.date)} ${label}曜`, isToday ? '今日' : '', STATUS_TEXT[status]].filter(Boolean).join(' ');
          return (
            <li
              key={day.date}
              aria-label={name}
              aria-current={isToday ? 'date' : undefined}
              data-selected={isSelected ? 'true' : undefined}
              className={cn('relative flex-1 text-center', isSelected ? 'bg-white/15 text-white' : 'text-white/80')}
            >
              <span aria-hidden className="mt-0.5 block text-note font-bold">
                {label}
              </span>
              <span aria-hidden data-testid="week-num" className="fl-num block text-[22px] leading-8 min-[360px]:text-[30px]">
                {Number(day.date.slice(8, 10))}
              </span>
              <span aria-hidden className="mt-[3px] flex h-[26px] items-center justify-center">
                <span
                  data-testid="week-dot"
                  className={cn(
                    'size-[22px] rounded-full',
                    status === 'rec' && 'bg-gold',
                    status === 'rest' && 'bg-grape',
                    status === 'none' && 'bg-white/15',
                    isToday && 'border-[3px] border-white',
                  )}
                />
              </span>
              {isSelected && (
                <span
                  aria-hidden
                  className="absolute bottom-0 left-1/2 -ml-[9px] border-x-[9px] border-b-[9px] border-x-transparent border-b-white"
                />
              )}
            </li>
          );
        })}
      </ol>
      <p className="px-4 py-1.5 text-note font-bold text-white">黄 記録　紫 おやすみ</p>
    </section>
  );
}
