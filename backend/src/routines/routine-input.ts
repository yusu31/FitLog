import { BadRequestException } from '@nestjs/common';
import { isUuid } from '../common/uuid.js';
import { ROUTINE_NAME_MAX } from '../db/schema.js';

const invalid = (details: string[]) => new BadRequestException({ code: 'VALIDATION_ERROR', message: '入力が正しくありません', details });

// POST /routines の本文。name は前後の空白を除いて 1〜20 字（数え方はコードポイント。DB の char_length と同じ）。
// recordId は写す元の記録（自分の筋トレの記録かどうかはサービスが DB で確かめる）。理由は項目ごとに集めて、1回で直せるようにする
export function parseRoutineInput(raw: unknown): { name: string; recordId: string } {
  const body = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  const details: string[] = [];

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const length = Array.from(name).length;
  if (typeof body.name !== 'string' || length < 1 || length > ROUTINE_NAME_MAX) {
    details.push(`name: 1〜${ROUTINE_NAME_MAX}字で入れてください（前後の空白は数えない）`);
  }

  const recordId = typeof body.recordId === 'string' ? body.recordId.toLowerCase() : '';
  if (!isUuid(recordId)) details.push('recordId: 記録の id（UUID）を指定してください');

  if (details.length > 0) throw invalid(details);
  return { name, recordId };
}
