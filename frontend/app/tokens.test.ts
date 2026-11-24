import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// A13-5・V-08: 文字サイズ・注記の色は globals.css の CSS 変数（トークン）で決める。各画面の置き換えは後の束
const css = readFileSync(join(__dirname, 'globals.css'), 'utf8');
const value = (name: string) => new RegExp(`${name}:\\s*([^;]+);`).exec(css)?.[1].trim();

describe('文字のトークン', () => {
  it('画面見出しは 28px', () => expect(value('--text-page-title')).toBe('28px'));
  it('節の見出しは 18px', () => expect(value('--text-section-title')).toBe('18px'));
  it('注記は 13px 以上（11px・12px の小さな注記を作らない）', () => expect(value('--text-note')).toBe('13px'));
  it('注記は大きさだけを決め、色は付けない（同じ名前の色があると text-note が色まで上書きし、ティールの面の上で灰色になる）', () => expect(css).not.toMatch(/--color-notes*:/));
  it('補足の文字は白の上で 4.5 以上の濃さ（#4b5563 = 7.5）', () => expect(value('--color-fg-muted')).toBe('#4b5563'));
});

// 02-9 D0-1: 役割の色は、ライト・ダークのどちらでも文字が読める比（普通の文字 4.5・大きい文字 3）を保つ
const lum = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const lf = css.replace(/\r\n/g, '\n');
const themeBlock = /@theme \{([\s\S]*?)\n\}/.exec(lf)?.[1] ?? '';
const darkBlock = /\n\.dark \{([\s\S]*?)\n\}/.exec(lf)?.[1] ?? '';
const pick = (block: string, name: string, fallback = '') => new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`).exec(block)?.[1] ?? fallback;

describe.each([
  ['ライト', (n: string) => pick(themeBlock, n)],
  ['ダーク', (n: string) => pick(darkBlock, n, pick(themeBlock, n))],
])('役割の色のコントラスト（%s）', (_name, get) => {
  it.each([
    ['--color-fg', '--color-surface', 4.5],
    ['--color-fg', '--color-canvas', 4.5],
    ['--color-fg-muted', '--color-surface', 4.5],
    ['--color-fg-muted', '--color-canvas', 4.5],
    ['--color-fg-subtle', '--color-surface', 4.5],
    ['--color-fg-subtle', '--color-canvas', 4.5],
    ['--color-brand', '--color-surface', 4.5],
    ['--color-brand', '--color-teal-light', 4.5],
    ['--color-fg', '--color-teal-light', 4.5],
    ['--color-fg', '--color-coral-light', 4.5],
    ['--color-fg', '--color-gold-light', 4.5],
  ])('%s は %s の上で %d 以上', (fg, bg, min) => {
    expect(ratio(get(fg), get(bg))).toBeGreaterThanOrEqual(min);
  });
});

// L3: 高さが低い画面（スマホの横向き）用の short: は、CSS のこの1行で決まる。500px を超えて広げると、普通の画面まで詰まってしまう
describe('short: バリアント（高さが低い画面）', () => {
  it('max-height: 500px の画面だけに効く', () => expect(css).toMatch(/@custom-variant short \(@media \(max-height: 500px\)\);/));
});

// 02-9 D0: ボタンの役割の色（docs/design.md「共通の部品とトークン」の表）。白い字を載せる面は 4.5 以上
describe.each([
  ['ライト', (n: string) => pick(themeBlock, n)],
  ['ダーク', (n: string) => pick(darkBlock, n, pick(themeBlock, n))],
])('ボタンの役割の色（%s）', (_name, get) => {
  it('主（濃ティール）・危険（コーラル）は白い字が 4.5 以上', () => {
    expect(ratio('#ffffff', get('--color-teal-dark'))).toBeGreaterThanOrEqual(4.5);
    expect(ratio('#ffffff', get('--color-coral-strong'))).toBeGreaterThanOrEqual(4.5);
  });
  it('副（薄ティールの面）の上の字（brand）は 4.5 以上', () => {
    expect(ratio(get('--color-brand'), get('--color-teal-light'))).toBeGreaterThanOrEqual(4.5);
  });
});

describe('小さな動きは「動きを減らす」設定で止まる（D0-4）', () => {
  it.each(['fl-pop-in', 'fl-done-pop', 'fl-tap'])('%s は prefers-reduced-motion: reduce の中でも指定がある', (cls) => {
    const blocks = [...lf.matchAll(/@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n  \}/g)].map((m) => m[1]).join('\n');
    expect(blocks).toContain(`.${cls}`);
  });
});
