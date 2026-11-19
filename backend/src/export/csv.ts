// CSV を作る部品。Excel で開く前提（docs: 記録の書き出し）。
// ・先頭に BOM（バイト順マーク。U+FEFF）を付ける: 付けないと Excel が日本語を Shift_JIS と見て文字化けする
// ・数式注入の対策: 文字列の先頭が = + - @（とタブ・復帰）だと、Excel が数式として実行しうる。先頭に ' を付けて文字にする
// ・カンマ・引用符・改行を含むセルは "" で囲み、中の " は "" にする（RFC 4180）
export const CSV_BOM = String.fromCharCode(0xfeff);

export type CsvValue = string | number | null;

export function csvCell(value: CsvValue): string {
  if (value === null) return '';
  if (typeof value === 'number') return String(value);
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) || safe !== value ? quoteIfNeeded(safe) : safe;
}

function quoteIfNeeded(s: string): string {
  return /[",\r\n\t]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

export function toCsv(header: string[], rows: CsvValue[][]): string {
  const lines = [header, ...rows].map((row) => row.map(csvCell).join(','));
  return `${CSV_BOM}${lines.join('\r\n')}\r\n`;
}
