import { BadRequestException } from '@nestjs/common';

const DATE = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

// GET /week の date・GET /feed の weekStart（field はエラーの理由に出す名前）（日本時間の日付 YYYY-MM-DD）。実在しない日付（2月30日など）は、JavaScript が3月2日に繰り上げてしまうので、年月日が元のままかを確かめる
export function parseWeekDate(raw: unknown, field = 'date'): string {
  const m = typeof raw === 'string' ? DATE.exec(raw) : null;
  if (m) {
    const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
    const d = new Date(Date.UTC(year, month - 1, day));
    if (d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day) return raw as string;
  }
  throw new BadRequestException({
    code: 'VALIDATION_ERROR',
    message: '入力が正しくありません',
    details: [`${field}: 実在する日付（YYYY-MM-DD。例: 2026-10-26）で指定してください`],
  });
}
