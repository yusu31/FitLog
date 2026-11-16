'use client';

import { useGetStats } from '@/lib/api/generated';
import { formatDistance } from '@/lib/format';
import { locateOnRoute, nextText } from '@/lib/japan-route';
import { toLocalDate } from '@/lib/shared/local-date';

// 今週のラン（N9）。ランが多い週だけ、自分タブの上のほうに出る（筋肉の図は筋トレの人向けなので、その下へ）。
// 今週の距離と、日本縦断（F-28）の次の町までの距離。読めなかったときは何も出さない（無くても自分タブは使える）
export function WeekRunSection() {
  const stats = useGetStats({ date: toLocalDate(new Date()) });
  const data = stats.data?.status === 200 ? stats.data.data : null;
  if (!data) return null;
  const thisWeek = data.weekly[data.weekly.length - 1];

  return (
    <section aria-labelledby="week-run-heading" className="fl-slab px-4 py-3">
      <h2 id="week-run-heading" className="text-sm font-extrabold text-sub-strong">
        今週のラン
      </h2>
      <p className="mt-1">
        <span className="fl-num text-3xl">{formatDistance(thisWeek?.runDistanceM ?? 0)}</span>
      </p>
      <p className="mt-1 text-sm font-bold text-teal-dark">日本縦断: {nextText(locateOnRoute(data.totalRunDistanceM))}</p>
    </section>
  );
}
