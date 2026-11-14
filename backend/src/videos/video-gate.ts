import { visibleUntilOf } from './video-expiry.js';

// 仲間の動画を見る条件（案B・Issue #220）。今週（日本時間の月曜 0:00〜日曜 24:00）に、自分の動画が1本以上あること。
// 動画の見える期限（visible_until）は記録の週の日曜 24:00 JST なので、今週の期限と同じ期限の動画があれば、撮った週は今週。
// 週の切り替わり（日曜 24:00 = 月曜 0:00 JST）は期限と同じ関数（visibleUntilOf）で決める
export function hasShotThisWeek(now: Date, myVisibleUntils: readonly Date[]): boolean {
  const thisWeekEnd = visibleUntilOf(now).getTime();
  return myVisibleUntils.some((until) => until.getTime() === thisWeekEnd);
}
