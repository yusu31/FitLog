// 画面に出す数字・日付の整え方（S-10 今日・S-30 自分）。純粋な関数。
// 日付は日本時間の日付（YYYY-MM-DD）。曜日は UTC の暦で読む（端末のタイムゾーンを使わない）。
import type { SetValue } from '@/lib/today-menu';
import { toUnit, type WeightUnit } from '@/lib/unit';

export const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'] as const;

// 25 → "25"、22.5 → "22.5"。lb のときは lb に直した数（単位の文字は付けない）
export const formatWeight = (kg: number, unit: WeightUnit = 'kg'): string => String(toUnit(kg, unit));

// 重量 × 回数。自重（0kg）は「自重 × 回数」にする
export const formatSet = ({ weightKg, reps }: SetValue, unit: WeightUnit = 'kg'): string =>
  weightKg === 0 ? `自重 × ${reps}` : `${formatWeight(weightKg, unit)}${unit} × ${reps}`;

// 「40kg × 10回」。自重（0kg）は「自重 × 10回」（0kg と出さない）
export const formatSetWithReps = ({ weightKg, reps }: SetValue, unit: WeightUnit = 'kg'): string => `${formatSet({ weightKg, reps }, unit)}回`;

// 記録画面の上のバーの読み上げ（U2・A4）。「0/100」ではなく、何セット できたかと、前回のセット数
export const formatSetProgress = (done: number, previousCount: number): string =>
  previousCount > 0 ? `${done}セット できた（前回は${previousCount}セット）` : `${done}セット できた`;

// 2026-10-22 → "10/22"
export const formatMonthDay = (date: string): string => `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;

// 0〜6（日曜=0）
export const weekdayIndex = (date: string): number => new Date(`${date}T00:00:00Z`).getUTCDay();

// 5200 → "5.2km"、5040 → "5.04km"。0.01km（10m）の桁まで。1桁で足りる値は今までどおり（5000 → "5.0km"）。
// 取り込み直後の 5.04 と、保存後の表示をそろえるため（U18）
export function formatDistance(meters: number): string {
  const km = Math.round(meters / 10) / 100;
  const two = km.toFixed(2);
  return `${two.endsWith('0') ? km.toFixed(1) : two}km`;
}

// 1930 → "32:10"、3909 → "1:05:09"
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

// 1kmあたりのペース。5200m・1930秒 → "6:11/km"。秒は四捨五入して分:秒にそろえる。
// 距離・時間が 0 以下や数でないとき（0 割りを防ぐ）は null（画面は出さない）
export function formatPace(distanceM: number, durationS: number): string | null {
  if (!Number.isFinite(distanceM) || !Number.isFinite(durationS) || distanceM <= 0 || durationS <= 0) return null;
  return `${formatDuration(Math.round(durationS / (distanceM / 1000)))}/km`;
}

// UTC の時刻 → 日本時間の "H:mm"（端末のタイムゾーンを使わない）。"2026-10-22T03:05:00.000Z" → "12:05"
export function formatJstTime(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 9 * 3600 * 1000);
  return `${d.getUTCHours()}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

// 続きの記録（3時間以内の記録にセットが残っている）を開いたときの表示・読み上げ（D3 L12）。
// 始めたばかりの「2セット できた」と取り違えないよう「続きから（2セット済み）」と言い分ける。
// carried=開いたときに入っていたセット数、added=この画面で足したセット数
export function formatResumeProgress(carried: number, added: number, previousCount: number): string {
  const head = `続きから（${carried}セット済み）`;
  const now = added > 0 ? `・いま${added}セット できた` : '';
  const prev = previousCount > 0 ? `（前回は${previousCount}セット）` : '';
  return `${head}${now}${prev}`;
}
