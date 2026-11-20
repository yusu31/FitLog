import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// A13-5・V-08: 文字サイズ・注記の色は globals.css の CSS 変数（トークン）で決める。各画面の置き換えは後の束
const css = readFileSync(join(__dirname, 'globals.css'), 'utf8');
const value = (name: string) => new RegExp(`${name}:\\s*([^;]+);`).exec(css)?.[1].trim();

describe('文字のトークン', () => {
  it('画面見出しは 28px', () => expect(value('--text-page-title')).toBe('28px'));
  it('節の見出しは 18px', () => expect(value('--text-section-title')).toBe('18px'));
  it('注記は 13px 以上（11px・12px の小さな注記を作らない）', () => expect(value('--text-note')).toBe('13px'));
  it('注記の色は補足の文字の色（役割の名前 fg-muted）に従う', () => expect(value('--color-note')).toBe('var(--color-fg-muted)'));
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
