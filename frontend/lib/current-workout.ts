import type { DayMode } from './day-mode';
import { shouldStartNewRecord } from './record-flow';

// いま記録している筋トレの記録（records の1行）。種目を変えても同じ記録にセットを足すため、画面をまたいで持つ。
// ページを再読み込みすると消える（端末への保存は 02-4）。消えたら次の「できた」で新しい記録になる。
// きのうの分（F-21）は今日の記録とは別に持つ（きのうを入力している間に、今日の記録へセットが継ぎ足されないように）
type Current = { recordId: string; lastSetAtMs: number };
const slots: Record<DayMode, Current | null> = { today: null, yesterday: null };

// 次のセットを足す記録を返す。最後のセットから3時間以上あいていたら（またはまだ無ければ）新しい記録の ID を作る
export function recordForNextSet(nowMs: number, day: DayMode = 'today'): { recordId: string; isNew: boolean } {
  const current = slots[day];
  const isNew = !current || shouldStartNewRecord(current.lastSetAtMs, nowMs);
  const recordId = isNew || !current ? crypto.randomUUID() : current.recordId;
  slots[day] = { recordId, lastSetAtMs: nowMs };
  return { recordId, isNew };
}

// 画面を開いたとき、すでに続きの記録があるか（セットの一覧を出すため）。3時間以上あいていれば無いものとして扱う
export function activeRecordId(nowMs: number, day: DayMode = 'today'): string | null {
  const current = slots[day];
  return current && !shouldStartNewRecord(current.lastSetAtMs, nowMs) ? current.recordId : null;
}

// テスト用
export function resetCurrentWorkout(): void {
  slots.today = null;
  slots.yesterday = null;
}
