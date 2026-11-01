import { BadRequestException } from '@nestjs/common';
import { isUuid } from '../common/uuid.js';

export const WEIGHT_MAX = 500;
export const REPS_MAX = 999;
// 何セット目か。設計書に上限が無かったので、1つの種目で足りる数として 99 を既定にした（docs/design.md 7章）
export const SET_NO_MAX = 99;

const isInt = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
// 重量は 0〜500 の 0.5 刻み。2倍して整数になるかで「0.5 刻み」を見る（0.5 は2進数で正確に表せるので、誤差が出ない）
const isWeight = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= WEIGHT_MAX && Number.isInteger(v * 2);

export type SetInput = { id: string; exerciseId: string; setNo: number; weightKg: number; reps: number };

// セットを足すときの入力検査（docs/design.md 4章 POST /records/{id}/sets・docs/testing-design.md 3-1）。
// 数は数（文字列の "40" は受けない）。理由は項目ごとに集めて、1回で直せるようにする
export function parseSetInput(raw: unknown): SetInput {
  const body = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  const details: string[] = [];

  if (!isUuid(body.id)) details.push('id: UUID で指定してください');
  if (!isUuid(body.exerciseId)) details.push('exerciseId: UUID で指定してください');
  if (!isInt(body.setNo, 1, SET_NO_MAX)) details.push(`setNo: 1〜${SET_NO_MAX} の整数で指定してください`);
  if (!isWeight(body.weightKg)) details.push(`weightKg: 0〜${WEIGHT_MAX} の 0.5 刻みの数で指定してください`);
  if (!isInt(body.reps, 1, REPS_MAX)) details.push(`reps: 1〜${REPS_MAX} の整数で指定してください`);

  if (details.length > 0) {
    throw new BadRequestException({ code: 'VALIDATION_ERROR', message: '入力が正しくありません', details });
  }
  return {
    id: (body.id as string).toLowerCase(),
    exerciseId: (body.exerciseId as string).toLowerCase(),
    setNo: body.setNo as number,
    weightKg: body.weightKg as number,
    reps: body.reps as number,
  };
}
