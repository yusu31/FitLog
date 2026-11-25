import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

// D0-1: ボタンの形を、役割の表（docs/design.md「ボタンと部品の役割」）の外に増やさない。
// 主・副・文字・アイコン・危険は ThickButton（移動するものは buttonClass）に任せ、生の <button> は下の表にある役割だけに許す。
// 新しく <button> を書いて落ちたら、まず ThickButton・Segmented・Switch で作れないかを見る。作れない役割のときだけ、理由の分かる役割名で表に足す
const ROOT = join(__dirname, '..');

type Role = '切り替え' | 'タイル' | '開閉' | '数字の操作' | 'メニュー' | '開始' | '部品';
const RAW_BUTTONS: Record<string, [count: number, role: Role]> = {
  'components/auth/password-field.tsx': [1, '切り替え'],
  'components/body/weight-chart.tsx': [1, '切り替え'],
  'components/chara/chara-editor.tsx': [3, '切り替え'],
  'components/exercises/exercises-view.tsx': [4, '切り替え'],
  'components/fitlog/info-tip.tsx': [1, '開閉'],
  'components/fitlog/tab-bar.tsx': [1, '開始'],
  'components/fitlog/thick-button.tsx': [1, '部品'],
  'components/friends/feed-media.tsx': [1, 'タイル'],
  'components/friends/stamp-button.tsx': [1, '切り替え'],
  'components/me/records-list.tsx': [1, 'メニュー'],
  'components/me/stats-view.tsx': [4, '切り替え・日本縦断の開閉'],
  'components/record-detail/record-memo.tsx': [1, '切り替え'],
  'components/record/done-sets.tsx': [1, 'メニュー'],
  'components/record/friend-picker.tsx': [2, '切り替え'],
  'components/record/record-view.tsx': [3, 'メニュー'],
  'components/record/rest-timer-bar.tsx': [1, '開閉'],
  'components/record/result-sheet.tsx': [1, 'タイル'],
  'components/record/stepper-field.tsx': [4, '数字の操作'],
  'components/routine/routine-starter.tsx': [2, 'タイル'],
  'components/run/gps-tracker.tsx': [1, '開始'],
  'components/today/week-strip.tsx': [1, '切り替え'],
  'components/ui/segmented.tsx': [1, '部品'],
  'components/ui/switch.tsx': [1, '部品'],
  'components/video-grid/video-grid.tsx': [1, 'タイル'],
};
// 厚みのある面（fl-thick）を直に書いてよい所。ほかは ThickButton・buttonClass から受け取る
const RAW_THICK = ['components/fitlog/tab-bar.tsx', 'components/fitlog/thick-button.tsx'];

function sources(dir: string): string[] {
  return readdirSync(join(ROOT, dir), { withFileTypes: true, recursive: true })
    .filter((e) => e.isFile() && e.name.endsWith('.tsx') && !e.name.endsWith('.test.tsx'))
    .map((e) => relative(ROOT, join(e.parentPath, e.name)).replaceAll('\\', '/'));
}
// 説明文の中の <button> は数えない
const code = (f: string) => readFileSync(join(ROOT, f), 'utf-8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const files = [...sources('components'), ...sources('app')];

describe('ボタンの役割（D0-1）', () => {
  it('調べるファイルがある（探し方が壊れて0件になっていない）', () => {
    expect(files.length).toBeGreaterThan(80);
  });

  it('生の <button> は、役割の表にあるファイルと数だけ', () => {
    const found = Object.fromEntries(files.map((f) => [f, (code(f).match(/<button\b/g) ?? []).length]).filter(([, n]) => n !== 0));
    expect(found).toEqual(Object.fromEntries(Object.entries(RAW_BUTTONS).map(([f, [n]]) => [f, n])));
  });

  it('厚みのある面（fl-thick）を手書きしない', () => {
    expect(files.filter((f) => /\bfl-thick\b/.test(code(f))).sort()).toEqual(RAW_THICK);
  });

  it('リンクに、主ボタンの色の面を手書きしない（buttonClass を使う）', () => {
    const bad = files.flatMap((f) =>
      [...code(f).matchAll(/<(?:Link|a)\b(?:=>|[^>])*?className="([^"]*)"/g)].filter((m) => /\bbg-(?:teal-dark|grape-dark|coral-strong|gold|night)\b/.test(m[1]!) && /\bmin-h-1[1-4]\b/.test(m[1]!)).map(() => f),
    );
    expect(bad).toEqual([]);
  });
});
