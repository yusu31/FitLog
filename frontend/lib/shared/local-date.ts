// 日本時間（Asia/Tokyo）の日付（YYYY-MM-DD）を出す。画面と API が同じ結果を出す「共通の関数」
// （docs/design.md 7章・docs/testing-design.md 3-3）。画面側の取り込みは画面の PR で行い、同じテストの表で確かめる。
//
// 端末や実行環境のタイムゾーンを使わない（T-DATE-11）。日本は夏時間が無く、UTC+9 で固定なので、9時間足して UTC の暦で読めば足りる。
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

export function toLocalDate(instant: Date): string {
  return new Date(instant.getTime() + JST_OFFSET_MS).toISOString().slice(0, 10);
}
