import { CSV_BOM, csvCell, toCsv } from './csv.js';

// CSV の部品（Excel で開く前提。数式注入・引用符・改行・BOM）
describe('csvCell', () => {
  it('ふつうの文字列はそのまま', () => {
    expect(csvCell('ベンチプレス')).toBe('ベンチプレス');
  });
  it.each(['=1+1', '+1', '-1', '@SUM(A1)'])('先頭が %s の文字列は、先頭に \' を付けて数式にならないようにする', (v) => {
    expect(csvCell(v)).toBe(`'${v}`);
  });
  it.each(['\t=1', '\r=1'])('先頭がタブ・復帰の文字列も無害化する（引用符で囲む）', (v) => {
    expect(csvCell(v).startsWith('"\'')).toBe(true);
  });
  it('カンマ・引用符・改行を含むなら、"" で囲み、引用符は2つにする', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('a"b')).toBe('"a""b"');
    expect(csvCell('a\nb')).toBe('"a\nb"');
  });
  it('数値は文字列にしてそのまま（負でも無害化しない）。null は空', () => {
    expect(csvCell(-5)).toBe('-5');
    expect(csvCell(42.5)).toBe('42.5');
    expect(csvCell(null)).toBe('');
  });
});

describe('toCsv', () => {
  it('先頭に BOM、行は CRLF、末尾も CRLF', () => {
    const out = toCsv(['a', 'b'], [[1, 'x']]);
    expect(out).toBe(`${CSV_BOM}a,b\r\n1,x\r\n`);
    expect(CSV_BOM).toBe('﻿');
  });
});
