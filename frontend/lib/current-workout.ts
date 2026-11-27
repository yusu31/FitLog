import type { DayMode } from './day-mode';
import { shouldStartNewRecord } from './record-flow';

// いま記録している筋トレの記録（records の1行）。種目を変えても同じ記録にセットを足すため、画面をまたいで持つ。
// ページを再読み込みするとメモリは消える。消えたときは、サーバーが「記録中」と返した記録（一覧の active。N2）を続きにする。
// きのうの分（F-21）は今日の記録とは別に持つ（きのうを入力している間に、今日の記録へセットが継ぎ足されないように）。
// きのうの分には、サーバーの記録中を使わない（今日の記録に混ざらないように）
type Current = { recordId: string; lastSetAtMs: number };
const slots: Record<string, Current | null> = { today: null, yesterday: null };

// 記録ごとの自己ベストの回数（終了のまとめ用。メモリだけ。読み直すと 0 に戻り、まとめには出さない）
const bests = new Map<string, number>();
// 自己ベストが出た種目名（記録ごと。重複なし・出た順）
const bestNames = new Map<string, string[]>();

function serverRecordFor(day: DayMode, serverActiveId: string | null | undefined): string | null {
  return day === 'today' ? (serverActiveId ?? null) : null;
}

// 次のセットを足す記録を返す。サーバーが記録中と言う記録があればそれを正とし、無ければ、
// 最後のセットから3時間以上あいていたら（またはまだ無ければ）新しい記録の ID を作る
export function recordForNextSet(
  nowMs: number,
  day: DayMode = 'today',
  serverActiveId?: string | null,
): { recordId: string; isNew: boolean } {
  const server = serverRecordFor(day, serverActiveId);
  const current = slots[day];
  const memoryValid = !!current && !shouldStartNewRecord(current.lastSetAtMs, nowMs);
  if (server && (!memoryValid || current?.recordId !== server)) {
    // メモリが無い・古い、または別の記録を指しているとき（別の端末で続けたなど）はサーバーを正とする
    slots[day] = { recordId: server, lastSetAtMs: nowMs };
    return { recordId: server, isNew: false };
  }
  const isNew = !memoryValid;
  const recordId = isNew || !current ? crypto.randomUUID() : current.recordId;
  slots[day] = { recordId, lastSetAtMs: nowMs };
  return { recordId, isNew };
}

// 画面を開いたとき、すでに続きの記録があるか（セットの一覧を出すため）。
// メモリの記録が3時間以内ならそれ、無ければサーバーが記録中と返した記録
export function activeRecordId(nowMs: number, day: DayMode = 'today', serverActiveId?: string | null): string | null {
  const server = serverRecordFor(day, serverActiveId);
  const current = slots[day];
  const memory = current && !shouldStartNewRecord(current.lastSetAtMs, nowMs) ? current.recordId : null;
  return server ?? memory;
}

// 「今日はここまで」を押したあと。今日の分の続きの記録を忘れ、次の「できた」は新しい記録になる（きのうの分は残す）
export function endCurrentWorkout(): void {
  slots.today = null;
}

// 自己ベストが出たセットを数える（記録ごと）
export function noteBest(recordId: string, exerciseName?: string): void {
  bests.set(recordId, (bests.get(recordId) ?? 0) + 1);
  if (exerciseName) {
    const names = bestNames.get(recordId) ?? [];
    if (!names.includes(exerciseName)) bestNames.set(recordId, [...names, exerciseName]);
  }
}

// 自己ベストが出た種目の名前（終了のまとめで種目名つきに出す用）
export function bestNamesOf(recordId: string): string[] {
  return bestNames.get(recordId) ?? [];
}

export function bestCountOf(recordId: string): number {
  return bests.get(recordId) ?? 0;
}

// テスト用
export function resetCurrentWorkout(): void {
  slots.today = null;
  for (const key of Object.keys(slots)) slots[key] = null;
  bests.clear();
  bestNames.clear();
}
