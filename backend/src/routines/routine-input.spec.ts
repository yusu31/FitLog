import { BadRequestException } from '@nestjs/common';
import { parseRoutineInput } from './routine-input.js';

const RECORD_ID = '0b0c3a3e-1d1f-4a4b-9c9d-2e2f3a3b4c4d';

const detailsOf = (raw: unknown): string[] => {
  try {
    parseRoutineInput(raw);
  } catch (err) {
    return ((err as BadRequestException).getResponse() as { details: string[] }).details;
  }
  throw new Error('通ってしまった');
};

// 名前の長さは境界値（0・1・20・21字）。空白だけは前後を除くと0字。絵文字は1字と数える（コードポイント）
describe('parseRoutineInput（ルーティンの保存の入力。F3）', () => {
  it.each([
    ['1字', 'A'],
    ['20字', 'あ'.repeat(20)],
    ['前後の空白は除く', '  脚の日  '],
    ['絵文字を含めて20字', '💪'.repeat(20)],
  ])('通る: %s', (_label, name) => {
    expect(parseRoutineInput({ name, recordId: RECORD_ID }).name).toBe(name.trim());
  });

  it.each([
    ['0字', ''],
    ['空白だけ', '   '],
    ['21字', 'あ'.repeat(21)],
    ['文字列でない', 12],
    ['無い', undefined],
  ])('名前で止まる: %s', (_label, name) => {
    expect(detailsOf({ name, recordId: RECORD_ID })).toEqual([expect.stringMatching(/^name:/)]);
  });

  it('recordId は大文字でも小文字に直して通す', () => {
    expect(parseRoutineInput({ name: '胸', recordId: RECORD_ID.toUpperCase() }).recordId).toBe(RECORD_ID);
  });

  it.each([
    ['UUID でない', 'abc'],
    ['無い', undefined],
  ])('recordId で止まる: %s', (_label, recordId) => {
    expect(detailsOf({ name: '胸', recordId })).toEqual([expect.stringMatching(/^recordId:/)]);
  });

  it('両方まちがいなら理由を2つまとめて返す', () => {
    expect(detailsOf(null)).toHaveLength(2);
  });
});
