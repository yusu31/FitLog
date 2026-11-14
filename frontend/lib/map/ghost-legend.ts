import { formatDistance, formatMonthDay, formatPace } from '@/lib/format';
import { toLocalDate } from '@/lib/shared/local-date';

// 地図ゴースト（F-17）の凡例。「点線は前回（10/20・4.2km・7:09/km）」。良し悪しを決める言葉は入れない（勝ち負けでなく、並べて見るだけ）
export function ghostLegend(prev: { recordedAt: string; distanceM: number; durationS: number }): string {
  const parts = [formatMonthDay(toLocalDate(new Date(prev.recordedAt))), formatDistance(prev.distanceM), formatPace(prev.distanceM, prev.durationS)];
  return `点線は前回（${parts.filter(Boolean).join('・')}）`;
}
