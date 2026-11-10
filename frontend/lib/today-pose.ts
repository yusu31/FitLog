import type { PoseKey } from '@/components/fitlog/sprite';

// 今日の画面のキャラのポーズ（features.md の F-31。prototype/v8 の POSE_OF）。
// 休み→くつろぎ／今日の分が終わった→ガッツポーズ／3日以上あいた→おかえり／朝（10時前）→朝の伸び／それ以外→準備OK
// 時刻は日本時間。端末のタイムゾーンを使わない（T-DATE-11 と同じ考え方）
export function todayPose(input: { restToday: boolean; allDone: boolean; welcomeBack: boolean; now: Date }): PoseKey {
  if (input.restToday) return 'relax';
  if (input.allDone) return 'cheer';
  if (input.welcomeBack) return 'welcome';
  return jstHour(input.now) < 10 ? 'stretch' : 'ready';
}

export function jstHour(now: Date): number {
  return Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, hourCycle: 'h23', timeZone: 'Asia/Tokyo' }).format(now));
}
