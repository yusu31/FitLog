import type { Logger } from '@nestjs/common';
import { logFromBetterAuth } from './auth-log.js';

const fakeLogger = () => {
  const calls: { level: string; fields: Record<string, unknown> }[] = [];
  const logger = {
    error: (f: Record<string, unknown>) => calls.push({ level: 'error', fields: f }),
    warn: (f: Record<string, unknown>) => calls.push({ level: 'warn', fields: f }),
    log: (f: Record<string, unknown>) => calls.push({ level: 'info', fields: f }),
    debug: (f: Record<string, unknown>) => calls.push({ level: 'debug', fields: f }),
  } as unknown as Logger;
  return { logger, calls };
};

describe('logFromBetterAuth（better-auth のログを安全にアプリのログへ通す）', () => {
  // T-AUTHLOG-01: SQL の引数を含む DB エラーは、本文を捨てて印だけ出す
  it('エラーが付いているときは、本文（SQL とその引数）を出さず、エラーの印だけ出す', () => {
    const { logger, calls } = fakeLogger();
    const err = Object.assign(new Error('Failed query: insert into "accounts" ... params: credential,SECRET-HASH'), { code: '23503' });
    logFromBetterAuth(logger, 'error', 'Error DrizzleQueryError: Failed query: insert ... params: credential,SECRET-HASH', err);
    const text = JSON.stringify(calls);
    expect(text).not.toContain('SECRET-HASH');
    expect(text).not.toContain('Failed query');
    expect(calls[0]).toMatchObject({ level: 'error', fields: { event: 'auth.library_log', code: '23503', errName: 'Error' } });
  });

  // T-AUTHLOG-02: エラーが付いていなくても、SQL らしい文字列は捨てる
  it('SQL らしい文字列は、エラーが付いていなくても出さない', () => {
    const { logger, calls } = fakeLogger();
    logFromBetterAuth(logger, 'error', 'Failed query: select * from users where email = $1 params: a@example.com');
    expect(JSON.stringify(calls)).not.toContain('a@example.com');
    expect(calls[0].fields).toMatchObject({ dropped: true });
  });

  // T-AUTHLOG-03: 注意書きのような短い文字列は通す（陽性対照。何でも捨てているわけではない）
  it('短い注意書きの文字列は、そのまま detail に出す', () => {
    const { logger, calls } = fakeLogger();
    logFromBetterAuth(logger, 'warn', 'Rate limit exceeded');
    expect(calls[0]).toMatchObject({ level: 'warn', fields: { detail: 'Rate limit exceeded' } });
  });

  it('オブジェクトの引数が付いているときは、本文を捨てる（中に何が入っているか分からないため）', () => {
    const { logger, calls } = fakeLogger();
    logFromBetterAuth(logger, 'info', '短い文字列', { email: 'a@example.com' });
    expect(JSON.stringify(calls)).not.toContain('a@example.com');
    expect(calls[0].fields).toMatchObject({ dropped: true });
  });
});
