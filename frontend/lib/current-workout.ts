import { shouldStartNewRecord } from './record-flow';

// いま記録している筋トレの記録（records の1行）。種目を変えても同じ記録にセットを足すため、画面をまたいで持つ。
// ページを再読み込みすると消える（端末への保存は 02-4）。消えたら次の「できた」で新しい記録になる
type Current = { recordId: string; lastSetAtMs: number };
let current: Current | null = null;

// 次のセットを足す記録を返す。最後のセットから3時間以上あいていたら（またはまだ無ければ）新しい記録の ID を作る
export function recordForNextSet(nowMs: number): { recordId: string; isNew: boolean } {
  const isNew = !current || shouldStartNewRecord(current.lastSetAtMs, nowMs);
  const recordId = isNew || !current ? crypto.randomUUID() : current.recordId;
  current = { recordId, lastSetAtMs: nowMs };
  return { recordId, isNew };
}

// 画面を開いたとき、すでに続きの記録があるか（セットの一覧を出すため）。3時間以上あいていれば無いものとして扱う
export function activeRecordId(nowMs: number): string | null {
  return current && !shouldStartNewRecord(current.lastSetAtMs, nowMs) ? current.recordId : null;
}

// テスト用
export function resetCurrentWorkout(): void {
  current = null;
}
