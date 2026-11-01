import { BadRequestException } from '@nestjs/common';
import { FUTURE_LIMIT_MS, parseRecordInput } from './record-input.js';

// 記録を作るときの入力検査（docs/design.md 4章 POST /records・docs/testing-design.md T-DATE-07）。
const NOW = new Date('2026-11-01T03:00:00.000Z');
const ID = '5f0e1b6a-3c7d-4e2a-9b1f-0a2c4d6e8f10';
const valid = { id: ID, kind: 'workout', recordedAt: '2026-11-01T02:00:00.000Z' };
const parse = (raw: unknown) => parseRecordInput(raw, NOW);

describe('parseRecordInput（記録の入力検査）', () => {
  it('筋トレの記録は通り、recordedAt は Date になる', () => {
    expect(parse(valid)).toEqual({ id: ID, kind: 'workout', recordedAt: new Date('2026-11-01T02:00:00.000Z') });
  });

  it('休みの記録も通る', () => {
    expect(parse({ ...valid, kind: 'rest' }).kind).toBe('rest');
  });

  it('id は小文字にそろえる（DB の uuid の表記と同じにするため）', () => {
    expect(parse({ ...valid, id: ID.toUpperCase() }).id).toBe(ID);
  });

  describe('id', () => {
    it.each([[undefined], [null], [''], ['abc'], [123], ['5f0e1b6a-3c7d-4e2a-9b1f-0a2c4d6e8f1'], ['5f0e1b6a3c7d4e2a9b1f0a2c4d6e8f10']])('%j は 400', (id) => {
      expect(() => parse({ ...valid, id })).toThrow(BadRequestException);
    });
  });

  describe('kind', () => {
    // run（ラン）は F-04 の PR で足す。それまでは 400
    it.each([[undefined], [null], [''], ['Workout'], ['run'], ['swim'], [1]])('%j は 400', (kind) => {
      expect(() => parse({ ...valid, kind })).toThrow(BadRequestException);
    });
  });

  describe('recordedAt（ISO 8601 の日時）', () => {
    it.each([['2026-11-01T02:00:00Z'], ['2026-11-01T02:00:00.123Z'], ['2026-11-01T11:00:00+09:00'], ['2026-10-31T21:00:00-05:00']])('%s は通る', (recordedAt) => {
      expect(parse({ ...valid, recordedAt }).recordedAt.getTime()).toBe(new Date(recordedAt).getTime());
    });

    it.each([[undefined], [null], [''], ['昨日'], ['2026-11-01'], ['2026-11-01 02:00:00'], ['2026-02-30T00:00:00Z'], [1793000000000]])('%j は 400', (recordedAt) => {
      expect(() => parse({ ...valid, recordedAt })).toThrow(BadRequestException);
    });

    // T-DATE-07: 未来の時刻の上限（現在 + 5分まで受け付け、5分1秒は 400）
    it('現在 + 5分ちょうどは通る', () => {
      const at = new Date(NOW.getTime() + FUTURE_LIMIT_MS).toISOString();
      expect(parse({ ...valid, recordedAt: at }).recordedAt.toISOString()).toBe(at);
    });

    it('現在 + 5分1秒は 400', () => {
      const at = new Date(NOW.getTime() + FUTURE_LIMIT_MS + 1000).toISOString();
      expect(() => parse({ ...valid, recordedAt: at })).toThrow(BadRequestException);
    });

    it('遠い過去は通る（電波がなくて何日もあとに届く記録がある）', () => {
      expect(parse({ ...valid, recordedAt: '2026-01-01T00:00:00Z' }).recordedAt.getFullYear()).toBe(2026);
    });
  });

  describe('入力そのものの型', () => {
    it.each([[undefined], [null], ['text'], [42], [[]]])('%j は 400', (raw) => {
      expect(() => parse(raw)).toThrow(BadRequestException);
    });
  });

  it('400 の応答は code=VALIDATION_ERROR と、項目ごとの理由（3項目とも誤りなら3つ）を持つ', () => {
    try {
      parse({ id: 'x', kind: 'run', recordedAt: 'あした' });
      expect.unreachable();
    } catch (err) {
      const body = (err as BadRequestException).getResponse() as { code: string; details: string[] };
      expect(body.code).toBe('VALIDATION_ERROR');
      expect(body.details).toHaveLength(3);
    }
  });
});
