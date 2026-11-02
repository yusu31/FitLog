import { BadRequestException } from '@nestjs/common';
import { parseWeekDate } from './week-input.js';

// GET /week の date の検査（実在する YYYY-MM-DD だけ通す）。
describe('parseWeekDate', () => {
  it.each(['2026-10-25', '2026-10-26', '2028-02-29', '2026-12-31'])('%s は通る', (date) => {
    expect(parseWeekDate(date)).toBe(date);
  });

  it.each([[undefined], [null], [''], ['2026-10-2'], ['20261025'], ['2026/10/25'], ['2026-10-25T00:00:00Z'], ['2026-13-01'], ['2026-00-10'], ['2026-02-30'], ['2027-02-29'], ['2026-04-31'], ['あした'], [20261025], [['2026-10-25', '2026-10-26']]])(
    '%j は 400',
    (date) => {
      expect(() => parseWeekDate(date)).toThrow(BadRequestException);
    },
  );

  it('400 の応答は code=VALIDATION_ERROR と、理由を持つ', () => {
    try {
      parseWeekDate('2026-02-30');
      expect.unreachable();
    } catch (err) {
      const body = (err as BadRequestException).getResponse() as { code: string; details: string[] };
      expect(body.code).toBe('VALIDATION_ERROR');
      expect(body.details).toHaveLength(1);
    }
  });
});
