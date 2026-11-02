// 画面に出す数字・日付の整え方（S-10 今日・S-30 自分）。純粋な関数。
// 日付は日本時間の日付（YYYY-MM-DD）。曜日は UTC の暦で読む（端末のタイムゾーンを使わない）。
import type { SetValue } from '@/lib/today-menu';

export const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'] as const;

// 25 → "25"、22.5 → "22.5"
export const formatWeight = (kg: number): string => String(kg);

// 重量 × 回数。自重（0kg）は「自重 × 回数」にする
export const formatSet = ({ weightKg, reps }: SetValue): string =>
  weightKg === 0 ? `自重 × ${reps}` : `${formatWeight(weightKg)}kg × ${reps}`;

// 2026-10-22 → "10/22"
export const formatMonthDay = (date: string): string => `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;

// 0〜6（日曜=0）
export const weekdayIndex = (date: string): number => new Date(`${date}T00:00:00Z`).getUTCDay();

// 5200 → "5.2km"
export const formatDistance = (meters: number): string => `${(meters / 1000).toFixed(1)}km`;

// 1930 → "32:10"、3909 → "1:05:09"
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
