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
    it.each([[undefined], [null], [''], ['Workout'], ['Run'], ['swim'], [1]])('%j は 400', (kind) => {
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

  describe('ラン（kind=run。F-04）', () => {
    const run = { distanceM: 5000, durationS: 1800 };
    const parseRun = (override: Record<string, unknown> = {}) => parse({ ...valid, kind: 'run', run: { ...run, ...override } });

    it('距離と時間つきなら通り、run に入る', () => {
      expect(parse({ ...valid, kind: 'run', run })).toEqual({ id: ID, kind: 'run', recordedAt: new Date(valid.recordedAt), run });
    });

    // T-RUN-01〜04・05〜08: 境界値（距離 100〜200,000 m・時間 60〜86,400 秒）
    it.each<[string, number, boolean]>([
      ['T-RUN-01 距離 99', 99, false],
      ['T-RUN-02 距離 100', 100, true],
      ['T-RUN-03 距離 200000', 200000, true],
      ['T-RUN-04 距離 200001', 200001, false],
    ])('%s', (_name, distanceM, ok) => {
      if (ok) expect(parseRun({ distanceM }).run?.distanceM).toBe(distanceM);
      else expect(() => parseRun({ distanceM })).toThrow(BadRequestException);
    });

    it.each<[string, number, boolean]>([
      ['T-RUN-05 時間 59', 59, false],
      ['T-RUN-06 時間 60', 60, true],
      ['T-RUN-07 時間 86400', 86400, true],
      ['T-RUN-08 時間 86401', 86401, false],
    ])('%s', (_name, durationS, ok) => {
      if (ok) expect(parseRun({ durationS }).run?.durationS).toBe(durationS);
      else expect(() => parseRun({ durationS })).toThrow(BadRequestException);
    });

    it.each([[1500.5], ['5000'], [null], [undefined], [NaN], [-1], [0]])('距離が整数でない・数でない（%j）は 400', (distanceM) => {
      expect(() => parseRun({ distanceM })).toThrow(BadRequestException);
    });

    it.each([[undefined], [null], ['x'], [5000], [[]]])('kind=run で run が %j は 400', (value) => {
      expect(() => parse({ ...valid, kind: 'run', run: value })).toThrow(BadRequestException);
    });

    it.each(['workout', 'rest'])('kind=%s に run を付けると 400（run は kind=run のときだけ）', (kind) => {
      expect(() => parse({ ...valid, kind, run })).toThrow(BadRequestException);
    });
  });

  describe('入力そのものの型', () => {
    it.each([[undefined], [null], ['text'], [42], [[]]])('%j は 400', (raw) => {
      expect(() => parse(raw)).toThrow(BadRequestException);
    });
  });

  it('400 の応答は code=VALIDATION_ERROR と、項目ごとの理由（3項目とも誤りなら3つ）を持つ', () => {
    try {
      parse({ id: 'x', kind: 'swim', recordedAt: 'あした' });
      expect.unreachable();
    } catch (err) {
      const body = (err as BadRequestException).getResponse() as { code: string; details: string[] };
      expect(body.code).toBe('VALIDATION_ERROR');
      expect(body.details).toHaveLength(3);
    }
  });
});
