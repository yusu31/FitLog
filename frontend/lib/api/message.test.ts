import { describe, expect, it } from 'vitest';
import { ApiError, sendErrorText } from './api-error';
import { messageOf } from './message';

const FALLBACK = '送れませんでした';

describe('messageOf', () => {
  it('message が文字列ならそれを返す。無い・空なら fallback', () => {
    expect(messageOf({ message: 'こんにちは' }, FALLBACK)).toBe('こんにちは');
    expect(messageOf({ message: '' }, FALLBACK)).toBe(FALLBACK);
    expect(messageOf(null, FALLBACK)).toBe(FALLBACK);
  });
});

describe('sendErrorText（書き込みの失敗を、画面に出せる文言にする）', () => {
  it('4xx（入力の誤り・重複など）は、API が返した日本語の文言を出す', () => {
    expect(sendErrorText(new ApiError(400, { code: 'VALIDATION', message: '距離は 0.1〜200km です' }), FALLBACK)).toBe(
      '距離は 0.1〜200km です',
    );
  });
  it('5xx は、内部の事情を出さず fallback にする', () => {
    expect(sendErrorText(new ApiError(500, { code: 'INTERNAL', message: 'stack trace' }), FALLBACK)).toBe(FALLBACK);
  });
  it('API のエラーでない例外（通信の途中で切れた等）も fallback', () => {
    expect(sendErrorText(new TypeError('Failed to fetch'), FALLBACK)).toBe(FALLBACK);
    expect(sendErrorText('x', FALLBACK)).toBe(FALLBACK);
  });
});
