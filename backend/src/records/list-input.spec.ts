import { BadRequestException } from '@nestjs/common';
import { DEFAULT_LIMIT, encodeCursor, MAX_LIMIT, parseListQuery } from './list-input.js';

// GET /records のクエリ（limit・cursor・kind）の検査。同値分割: 未指定／範囲内／範囲外／数でない。境界値: limit 0・1・100・101
describe('parseListQuery', () => {
  const ID = '11111111-1111-4111-8111-111111111111';

  it('何も指定しなければ limit は 20・cursor と kind は無し', () => {
    expect(parseListQuery({})).toEqual({ limit: DEFAULT_LIMIT, cursor: undefined, kind: undefined });
    expect(DEFAULT_LIMIT).toBe(20);
  });

  it.each([
    ['1', 1],
    ['20', 20],
    [String(MAX_LIMIT), MAX_LIMIT],
  ])('limit=%s は通る（境界: 下端 1・上端 MAX_LIMIT）', (raw, expected) => {
    expect(parseListQuery({ limit: raw }).limit).toBe(expected);
  });

  it('上端は 100', () => {
    expect(MAX_LIMIT).toBe(100);
  });

  it.each([['0'], [String(MAX_LIMIT + 1)], ['-1'], ['1.5'], ['abc'], [''], [' 5'], ['1e1'], [['1', '2']]])('limit=%j は 400', (raw) => {
    expect(() => parseListQuery({ limit: raw })).toThrow(BadRequestException);
  });

  it.each(['workout', 'run', 'rest'])('kind=%s は通る', (kind) => {
    expect(parseListQuery({ kind }).kind).toBe(kind);
  });

  it.each([['swim'], [''], ['WORKOUT'], [['run', 'rest']]])('kind=%j は 400', (kind) => {
    expect(() => parseListQuery({ kind })).toThrow(BadRequestException);
  });

  it('cursor は encodeCursor の結果を読み戻せる（時刻はミリ秒まで）', () => {
    const at = new Date('2026-10-26T03:00:00.123Z');
    const parsed = parseListQuery({ cursor: encodeCursor(at, ID) });
    expect(parsed.cursor).toEqual({ recordedAt: at, id: ID });
  });

  it.each([
    ['でたらめ'],
    [''],
    [Buffer.from('not json').toString('base64url')],
    [Buffer.from(JSON.stringify({ t: 'x', id: ID })).toString('base64url')],
    [Buffer.from(JSON.stringify({ t: 1, id: 'not-uuid' })).toString('base64url')],
    [Buffer.from(JSON.stringify({ t: 1e20, id: ID })).toString('base64url')],
    [Buffer.from(JSON.stringify([1, ID])).toString('base64url')],
  ])('壊れた cursor %j は 400', (cursor) => {
    expect(() => parseListQuery({ cursor })).toThrow(BadRequestException);
  });

  it('400 の応答は code=VALIDATION_ERROR と、項目ごとの理由を持つ', () => {
    try {
      parseListQuery({ limit: '0', kind: 'swim' });
      expect.unreachable();
    } catch (err) {
      const body = (err as BadRequestException).getResponse() as { code: string; details: string[] };
      expect(body.code).toBe('VALIDATION_ERROR');
      expect(body.details).toHaveLength(2);
    }
  });
});
