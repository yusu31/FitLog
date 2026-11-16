// 筋トレの「いま記録中」の判定（N1・N2。docs/design.md 7章）。
// 終了を押していない筋トレで、最後のセットから3時間たっていないものが記録中。
// 画面の「3時間以上あいたら別の記録」（frontend/lib/record-flow.ts）と同じ長さ。定期実行は置かず、読み出すときに計算する
export const SESSION_GAP_MS = 3 * 60 * 60 * 1000;

export function isWorkoutActive(
  record: { endedAt: Date | null; lastSetAt: Date | null; recordedAt: Date },
  now: Date,
): boolean {
  if (record.endedAt) return false;
  const last = record.lastSetAt ?? record.recordedAt;
  return now.getTime() - last.getTime() < SESSION_GAP_MS;
}
