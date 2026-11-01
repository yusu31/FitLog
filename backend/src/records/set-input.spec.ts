import { BadRequestException } from '@nestjs/common';
import { parseSetInput, SET_NO_MAX } from './set-input.js';

// セットを足すときの入力検査（docs/testing-design.md 3-1 の T-SET-02〜13。重量 0〜500・0.5 刻み、回数 1〜999 の整数）。
const ID = '5f0e1b6a-3c7d-4e2a-9b1f-0a2c4d6e8f10';
const EXERCISE_ID = '00000000-0000-4000-8000-000000000001';
const valid = { id: ID, exerciseId: EXERCISE_ID, setNo: 1, weightKg: 40, reps: 10 };
const parse = (override: Record<string, unknown> = {}) => parseSetInput({ ...valid, ...override });
const rejects = (override: Record<string, unknown>) => expect(() => parse(override)).toThrow(BadRequestException);

describe('parseSetInput（セットの入力検査）', () => {
  it('代表的な値（40kg×10）は通る', () => {
    expect(parse()).toEqual({ id: ID, exerciseId: EXERCISE_ID, setNo: 1, weightKg: 40, reps: 10 });
  });

  it('id・exerciseId は小文字にそろえる（DB の uuid の表記と同じにするため）', () => {
    const result = parse({ id: ID.toUpperCase(), exerciseId: EXERCISE_ID.toUpperCase() });
    expect(result.id).toBe(ID);
    expect(result.exerciseId).toBe(EXERCISE_ID);
  });

  describe('重量（0〜500・0.5 刻み）', () => {
    it.each<[string, number]>([
      ['T-SET-02 下端 0（自重の種目）', 0],
      ['T-SET-04 最小の刻み 0.5', 0.5],
      ['刻みの途中ではない 2.5', 2.5],
      ['T-SET-06 上端 500', 500],
      ['上端の1つ手前 499.5', 499.5],
    ])('%s は通る', (_name, weightKg) => {
      expect(parse({ weightKg }).weightKg).toBe(weightKg);
    });

    it.each<[string, unknown]>([
      ['T-SET-03 下端の外 -0.5', -0.5],
      ['T-SET-05 刻みの途中 0.25', 0.25],
      ['0.1（0.5 刻みでない）', 0.1],
      ['T-SET-07 上端の外 500.5', 500.5],
      ['600', 600],
      ['T-SET-13 数でない値 "abc"', 'abc'],
      ['数字の文字列 "40"（数で送る決まり）', '40'],
      ['無限大', Infinity],
      ['数でない NaN', NaN],
      ['null', null],
      ['未指定', undefined],
    ])('%s は 400', (_name, weightKg) => {
      rejects({ weightKg });
    });
  });

  describe('回数（1〜999 の整数）', () => {
    it.each<[string, number]>([
      ['T-SET-08 下端 1', 1],
      ['T-SET-10 上端 999', 999],
    ])('%s は通る', (_name, reps) => {
      expect(parse({ reps }).reps).toBe(reps);
    });

    it.each<[string, unknown]>([
      ['T-SET-09 下端の外 0', 0],
      ['-1', -1],
      ['T-SET-11 上端の外 1000', 1000],
      ['T-SET-12 整数でない 1.5', 1.5],
      ['T-SET-13 数でない値 "abc"', 'abc'],
      ['null', null],
      ['未指定', undefined],
    ])('%s は 400', (_name, reps) => {
      rejects({ reps });
    });
  });

  describe('セット番号（1〜99 の整数。その種目の何セット目か）', () => {
    it.each([[1], [2], [SET_NO_MAX]])('%i は通る', (setNo) => {
      expect(parse({ setNo }).setNo).toBe(setNo);
    });

    it.each([[0], [-1], [SET_NO_MAX + 1], [1.5], ['1'], [null], [undefined]])('%j は 400', (setNo) => {
      rejects({ setNo });
    });
  });

  describe('id・exerciseId', () => {
    it.each([[undefined], [null], [''], ['abc'], [123], ['5f0e1b6a3c7d4e2a9b1f0a2c4d6e8f10']])('id が %j は 400', (id) => {
      rejects({ id });
    });

    it.each([[undefined], [null], [''], ['abc'], [123]])('exerciseId が %j は 400', (exerciseId) => {
      rejects({ exerciseId });
    });
  });

  describe('入力そのものの型', () => {
    it.each([[undefined], [null], ['text'], [42], [[]]])('%j は 400', (raw) => {
      expect(() => parseSetInput(raw)).toThrow(BadRequestException);
    });
  });

  it('400 の応答は code=VALIDATION_ERROR と、項目ごとの理由（5項目とも誤りなら5つ）を持つ', () => {
    try {
      parseSetInput({ id: 'x', exerciseId: 'y', setNo: 0, weightKg: 'abc', reps: 0 });
      expect.unreachable();
    } catch (err) {
      const body = (err as BadRequestException).getResponse() as { code: string; details: string[] };
      expect(body.code).toBe('VALIDATION_ERROR');
      expect(body.details).toHaveLength(5);
    }
  });
});
