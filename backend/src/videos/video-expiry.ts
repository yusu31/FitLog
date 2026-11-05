import { toLocalDate } from '../common/local-date.js';
import { weekDates, weekStartOf } from '../common/week.js';

// 動画が仲間に見える期限（F-13）。記録の週の日曜 24:00（日本時間）= 翌週の月曜 0:00（日本時間）。
// 期限ちょうど以後は仲間に見せない（本人は期限に関係なく見られる）。週の決め方は 7マスと同じ共通の関数（common/week.ts）
export function visibleUntilOf(recordedAt: Date): Date {
  const nextMonday = weekDates(weekStartOf(toLocalDate(recordedAt)))[6]!;
  // 日曜の日付の翌日 0:00 JST。日曜 + 1 日 = 月曜
  return new Date(Date.parse(`${nextMonday}T00:00:00+09:00`) + 24 * 60 * 60 * 1000);
}
