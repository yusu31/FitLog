import { describe, expect, it } from 'vitest';
import { normalizeAvatar, parseAvatarInput } from './avatar-input.js';

const valid = { body: 'B', hair: 3, hairColor: 'blonde', shirtColor: 'coral', pantsColor: 'khaki', accessory: 'glasses' };
const old = { body: 'A', hair: 1, hairColor: 'brown', shirtColor: 'teal', pantsColor: 'navy' };

describe('parseAvatarInput', () => {
  it('決まった値なら、そのまま通す', () => {
    expect(parseAvatarInput(valid)).toEqual(valid);
  });

  it('accessory を省くと none', () => {
    const { accessory: _omit, ...rest } = valid;
    expect(parseAvatarInput(rest).accessory).toBe('none');
  });

  it.each([
    ['body', 'C'],
    ['hair', 6],
    ['hair', '1'],
    ['hairColor', 'pink'],
    ['shirtColor', 'khaki'],
    ['pantsColor', 'coral'],
    ['accessory', 'cap'],
  ])('%s が %j だと VALIDATION_ERROR', (key, v) => {
    expect(() => parseAvatarInput({ ...valid, [key]: v })).toThrow(/入力が正しくありません/);
  });

  it('必須の項目が無い・本文が空だと断る', () => {
    expect(() => parseAvatarInput({ body: 'A' })).toThrow();
    expect(() => parseAvatarInput(null)).toThrow();
  });
});

describe('normalizeAvatar', () => {
  it('古い行（accessory なし）は none を足す', () => {
    expect(normalizeAvatar(old)).toEqual({ ...old, accessory: 'none' });
  });

  it('読めない値は既定に戻す', () => {
    expect(normalizeAvatar({ body: 'Z', hair: 99 })).toMatchObject({ body: 'A', hair: 1, hairColor: 'brown' });
    expect(normalizeAvatar(null).shirtColor).toBe('teal');
  });
});
