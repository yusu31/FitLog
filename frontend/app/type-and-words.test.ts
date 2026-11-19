import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// A13-2・N-05・V-08: 文字の大きさはトークンだけで決める。英字ラベル・通じない言葉を画面に出さない（docs/design.md の表記ルール）
const root = join(__dirname, '..');
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (name === 'node_modules' || name === 'generated.ts') return [];
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
const sources = ['components', 'app', 'lib']
  .flatMap((d) => walk(join(root, d)))
  .filter((p) => /\.tsx?$/.test(p) && !/\.test\.tsx?$/.test(p) && !p.includes(join('components', 'ui')))
  .map((p) => ({ path: p.replace(root, ''), text: readFileSync(p, 'utf8') }));
// コメント行は見ない（// と {/* */}）
const code = (text: string) => text.split('\n').filter((l) => !/^\s*(\/\/|\{?\/\*|\*)/.test(l)).join('\n');
const offenders = (re: RegExp) => sources.filter((s) => re.test(code(s.text))).map((s) => s.path);

describe('文字サイズ（V-08・A13-5）', () => {
  it('12px 以下の文字サイズ（text-xs・text-[9〜12px]）を使わない。注記は text-note（13px）', () => {
    expect(offenders(/text-xs|text-\[(9|10|11|12)px\]/)).toEqual([]);
  });

  it('h1 の大きさは見出しのトークン（text-page-title）1種だけ', () => {
    const bad = sources.filter((s) => [...code(s.text).matchAll(/<h1\s[^>]*className="([^"]*)"/g)].some((m) => !/text-page-title|sr-only/.test(m[1])));
    expect(bad.map((s) => s.path)).toEqual([]);
  });
});

describe('言葉（A13-2・N-05）', () => {
  it('画面に出る英字ラベル（TEAM・NEXT・NOW・DONE・REST・RUN・INVITE・FITLOG）を使わない', () => {
    expect(offenders(/['"`>](TEAM|NEXT|NOW|DONE|REST|RUN|INVITE|FITLOG)['"`<]/)).toEqual([]);
  });

  it('通じない言葉（ルーティン・ヒートマップ・次の1枚・記録をくわしく）を使わない', () => {
    expect(offenders(/ルーティン|ヒートマップ|次の1枚|記録をくわしく/)).toEqual([]);
  });
});
