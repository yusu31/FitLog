import { BadRequestException } from '@nestjs/common';
import { BODY_PARTS, type BodyPart } from '../db/schema.js';

export const EXERCISE_NAME_MAX = 30;

// 自分用の種目を追加するときの入力検査（docs/design.md 種目・docs/testing-design.md T-EXR-01〜03）。
// 名前は前後の空白を取り除いて1〜30字（見た目の1文字を1と数える）。部位は body_part の7つのどれか。
// 名前と部位の両方が誤りのときは、理由を2つとも返す（直すのを1回で済ませるため）。
export function parseExerciseInput(raw: unknown): { name: string; bodyPart: BodyPart } {
  const body = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  const details: string[] = [];

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const length = Array.from(name).length;
  if (length < 1 || length > EXERCISE_NAME_MAX) details.push(`name: 1〜${EXERCISE_NAME_MAX}字で入力してください`);

  const bodyPart = body.bodyPart;
  if (typeof bodyPart !== 'string' || !(BODY_PARTS as readonly string[]).includes(bodyPart)) {
    details.push(`bodyPart: ${BODY_PARTS.join('・')} のどれかを指定してください`);
  }

  if (details.length > 0) {
    throw new BadRequestException({ code: 'VALIDATION_ERROR', message: '入力が正しくありません', details });
  }
  return { name, bodyPart: bodyPart as BodyPart };
}
