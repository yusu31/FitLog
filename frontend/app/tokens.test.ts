import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// A13-5・V-08: 文字サイズ・注記の色は globals.css の CSS 変数（トークン）で決める。各画面の置き換えは後の束
const css = readFileSync(join(__dirname, 'globals.css'), 'utf8');
const value = (name: string) => new RegExp(`${name}:\\s*([^;]+);`).exec(css)?.[1].trim();

describe('文字のトークン', () => {
  it('画面見出しは 28px', () => expect(value('--text-page-title')).toBe('28px'));
  it('節の見出しは 18px', () => expect(value('--text-section-title')).toBe('18px'));
  it('注記は 13px 以上（11px・12px の小さな注記を作らない）', () => expect(value('--text-note')).toBe('13px'));
  it('注記の色は白の上で 4.5 以上の濃さ（#4b5563 = 7.5）', () => expect(value('--color-note')).toBe('#4b5563'));
});
