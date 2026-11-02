// 週の範囲（月曜〜日曜）と、7マスの1日分の状態（docs/design.md 7章・docs/testing-design.md 3-3 T-DATE-08・09）。
// 画面と API が同じ結果を出す「共通の関数」。純粋な関数だけを置く（DB・Nest に依存しない）。
// 日付は日本時間の日付（YYYY-MM-DD）の文字列で受け渡す。時刻・端末のタイムゾーンは使わない（T-DATE-11）。

export type CellStatus = 'rec' | 'rest' | 'none';

const DAY_MS = 24 * 60 * 60 * 1000;

// YYYY-MM-DD を UTC の暦として読む（タイムゾーンのずれが入らないように）
const toUtcMs = (date: string): number => Date.parse(`${date}T00:00:00Z`);
const fromUtcMs = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

// その日を含む週の月曜。getUTCDay() は 日曜=0・月曜=1…土曜=6 なので、日曜は6日前、それ以外は (曜日 - 1) 日前
export function weekStartOf(date: string): string {
  const ms = toUtcMs(date);
  const day = new Date(ms).getUTCDay();
  return fromUtcMs(ms - ((day + 6) % 7) * DAY_MS);
}

// 月曜から7日分の日付
export function weekDates(weekStart: string): string[] {
  const ms = toUtcMs(weekStart);
  return Array.from({ length: 7 }, (_, i) => fromUtcMs(ms + i * DAY_MS));
}

// 1日分のマス。筋トレ・ランがあれば rec（休みと同じ日でも rec が優先。features.md UC-13）、休みだけなら rest、何もなければ none
export function cellStatus(kinds: ReadonlyArray<'workout' | 'run' | 'rest'>): CellStatus {
  if (kinds.some((k) => k === 'workout' || k === 'run')) return 'rec';
  return kinds.includes('rest') ? 'rest' : 'none';
}
