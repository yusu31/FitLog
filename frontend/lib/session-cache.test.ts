import { beforeEach, describe, expect, it } from 'vitest';
import { clearCachedUser, readCachedUser, writeCachedUser } from './session-cache';

describe('session-cache（最後に確認できたログイン中の人を端末に控える）', () => {
  beforeEach(() => localStorage.clear());

  it('何も控えていなければ null', () => {
    expect(readCachedUser()).toBeNull();
  });

  it('書いたものがそのまま読める（id と name だけ）', () => {
    writeCachedUser({ id: 'u1', name: 'ゆうす' });
    expect(readCachedUser()).toEqual({ id: 'u1', name: 'ゆうす' });
  });

  it('別の人を書くと上書きされる', () => {
    writeCachedUser({ id: 'u1', name: 'A' });
    writeCachedUser({ id: 'u2', name: 'B' });
    expect(readCachedUser()).toEqual({ id: 'u2', name: 'B' });
  });

  it('消すと null に戻る', () => {
    writeCachedUser({ id: 'u1', name: 'A' });
    clearCachedUser();
    expect(readCachedUser()).toBeNull();
  });

  it.each([
    ['壊れた JSON', '{oops'],
    ['配列', '[]'],
    ['id が無い', '{"name":"A"}'],
    ['name が文字列でない', '{"id":"u1","name":1}'],
    ['id が空', '{"id":"","name":"A"}'],
  ])('壊れた控え（%s）は無いものとして扱う', (_label, raw) => {
    localStorage.setItem('fitlog:last-user', raw);
    expect(readCachedUser()).toBeNull();
  });

  it('余計な項目（トークンなど）が混ざっていても、id と name 以外は返さない', () => {
    localStorage.setItem('fitlog:last-user', JSON.stringify({ id: 'u1', name: 'A', token: 'secret' }));
    expect(readCachedUser()).toEqual({ id: 'u1', name: 'A' });
  });
});
