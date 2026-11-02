import { readFileSync } from 'node:fs';
import path from 'node:path';

// ずれ検知: 画面の共通関数は、バックエンド（backend/src/common/）の元ファイルと中身が同じでなければならない。
// 片方だけ直すと、画面の仮表示と API の応答の結果が割れるため（docs/design.md 7章）。直すときは両方を同じに直す。
const SHARED = ['local-date', 'ghost', 'week'] as const;
const read = (p: string) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

describe('画面の共通関数がバックエンドの元ファイルと同一である', () => {
  it.each(SHARED)('%s.ts は backend/src/common の同名ファイルと中身が同じ', (name) => {
    const backend = read(path.resolve(__dirname, '../../../backend/src/common', `${name}.ts`));
    const frontend = read(path.resolve(__dirname, `${name}.ts`));
    expect(frontend).toBe(backend);
  });
});
