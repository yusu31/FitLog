import { JsonLogger, parseLevel } from './json-logger.js';
import { requestContext } from './request-context.js';

const collect = (minLevel = 'INFO') => {
  const lines: string[] = [];
  const logger = new JsonLogger(parseLevel(minLevel), (l) => lines.push(l));
  return { logger, lines, parsed: () => lines.map((l) => JSON.parse(l) as Record<string, unknown>) };
};

describe('JsonLogger', () => {
  // T-LOG-01: 1行 = 1つの JSON。operations.md 1-1 のフィールド名
  it('1行の JSON で、time（ISO）・level（大文字）・msg を出す', () => {
    const { logger, lines, parsed } = collect();
    logger.log('起動しました');
    expect(lines).toHaveLength(1);
    expect(lines[0].endsWith('\n')).toBe(true);
    const [e] = parsed();
    expect(e).toMatchObject({ level: 'INFO', msg: '起動しました' });
    expect(new Date(e.time as string).toISOString()).toBe(e.time);
  });

  // T-LOG-02: レベルの絞り込み（本番は INFO 以上）
  it('最小レベルより低いログは出さない', () => {
    const { logger, lines } = collect('WARN');
    logger.debug('d');
    logger.log('i');
    logger.warn('w');
    logger.error('e');
    expect(lines.map((l) => (JSON.parse(l) as { level: string }).level)).toEqual(['WARN', 'ERROR']);
  });

  // T-LOG-03: リクエストごとの入れ物から requestId を付ける
  it('リクエストの入れ物の中では requestId を付け、外では付けない', () => {
    const { logger, parsed } = collect();
    requestContext.run({ requestId: 'req-12345678' }, () => logger.log('中'));
    logger.log('外');
    const [inside, outside] = parsed();
    expect(inside.requestId).toBe('req-12345678');
    expect(outside).not.toHaveProperty('requestId');
  });

  // T-LOG-04: オブジェクトの項目は広げる。time・level は上書きさせない
  it('オブジェクトで渡した項目は JSON に広げ、time と level は上書きされない', () => {
    const { logger, parsed } = collect();
    logger.log({ msg: 'request', event: 'http.request', status: 200, level: 'FAKE', time: 'FAKE' });
    const [e] = parsed();
    expect(e).toMatchObject({ msg: 'request', event: 'http.request', status: 200, level: 'INFO' });
    expect(e.time).not.toBe('FAKE');
  });

  // T-LOG-05: Nest が最後に付ける context と、error の stack
  it('最後の文字列は context に、error の直前の文字列は err.stack に入る', () => {
    const { logger, parsed } = collect();
    logger.log('a', 'HealthController');
    logger.error('b', 'Error: boom\n    at x (y.ts:1:1)', 'Db');
    const [a, b] = parsed();
    expect(a.context).toBe('HealthController');
    expect(b).toMatchObject({ context: 'Db', err: { stack: 'Error: boom\n    at x (y.ts:1:1)' } });
  });

  it('parseLevel: 知らない値は INFO にする', () => {
    expect(parseLevel('warn')).toBe('WARN');
    expect(parseLevel('nonsense')).toBe('INFO');
    expect(parseLevel(undefined)).toBe('INFO');
  });
});
