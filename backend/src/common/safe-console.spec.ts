import { Logger } from '@nestjs/common';
import { installSafeConsole } from './safe-console.js';

describe('installSafeConsole', () => {
  const realError = console.error;
  afterEach(() => {
    console.error = realError;
  });

  const setup = () => {
    const passed: unknown[][] = [];
    console.error = (...args: unknown[]) => void passed.push(args);
    const logged: Record<string, unknown>[] = [];
    const logger = { error: (f: Record<string, unknown>) => logged.push(f) } as unknown as Logger;
    installSafeConsole(logger);
    return { passed, logged };
  };

  // T-CONSOLE-01: Error は本文を捨てて、種類と印だけ出す（better-call の '# SERVER_ERROR: ' と同じ形で呼ぶ）
  it('Error が渡されたら、本文（SQL の引数など）は出さず、種類と印だけを自前のログに出す', () => {
    const { passed, logged } = setup();
    const err = Object.assign(new Error('Failed query: insert ... params: SECRET-HASH'), { code: '53300' });
    console.error('# SERVER_ERROR: ', err);
    expect(passed).toHaveLength(0);
    expect(JSON.stringify(logged)).not.toContain('SECRET-HASH');
    expect(logged[0]).toMatchObject({ event: 'console.error', errName: 'Error', code: '53300' });
  });

  // T-CONSOLE-02: SQL らしい文字列も捨てる
  it('SQL らしい文字列は、Error でなくても出さない', () => {
    const { passed, logged } = setup();
    console.error('Failed query: select * from users where email = $1 params: a@example.com');
    expect(passed).toHaveLength(0);
    expect(JSON.stringify(logged)).not.toContain('a@example.com');
  });

  // T-CONSOLE-04: Error でも SQL でもない「オブジェクト」や、Postgres の重複エラーの説明文（Key (email)=(…)）も、本文を出さない
  // （壊す側のレビュー指摘: 以前はこれらがそのまま出ていた）
  it.each([
    ['オブジェクト', [{ email: 'a@example.com' }]],
    ['Postgres の重複エラーの説明', ['Key (email)=(a@example.com) already exists.']],
  ])('%s は元の console.error に渡さず、本文を出さない', (_name, args) => {
    const { passed, logged } = setup();
    console.error(...args);
    expect(passed).toHaveLength(0);
    expect(JSON.stringify(logged)).not.toContain('a@example.com');
    expect(logged[0]).toMatchObject({ event: 'console.error', dropped: true });
  });

  // T-CONSOLE-03（陽性対照）: ふつうの出力は、そのまま元の console.error に渡る。何でも握りつぶしているわけではない
  it('ふつうの文字列は、そのまま元の console.error に渡す', () => {
    const { passed, logged } = setup();
    console.error('plain message', 123);
    expect(passed).toEqual([['plain message', 123]]);
    expect(logged).toHaveLength(0);
  });

  it('2回呼んでも二重に包まない', () => {
    const { logged } = setup();
    const first = console.error;
    installSafeConsole({ error: () => undefined } as unknown as Logger);
    expect(console.error).toBe(first);
    console.error(new Error('x'));
    expect(logged).toHaveLength(1);
  });
});
