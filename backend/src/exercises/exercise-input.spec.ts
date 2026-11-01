import { BadRequestException } from '@nestjs/common';
import { BODY_PARTS } from '../db/schema.js';
import { parseExerciseInput } from './exercise-input.js';

// 自分用の種目の追加の入力検査（docs/testing-design.md T-EXR-01〜03。名前は1〜30字・同値分割＋限界値）。
const input = (name: unknown, bodyPart: unknown = 'chest') => ({ name, bodyPart });

describe('parseExerciseInput（種目の入力検査）', () => {
  describe('名前の文字数（限界値: 0・1・30・31字）', () => {
    it('0字は 400', () => {
      expect(() => parseExerciseInput(input(''))).toThrow(BadRequestException);
    });

    it('1字は通る', () => {
      expect(parseExerciseInput(input('橋'))).toEqual({ name: '橋', bodyPart: 'chest' });
    });

    it('30字は通る', () => {
      const name = 'あ'.repeat(30);
      expect(parseExerciseInput(input(name)).name).toBe(name);
    });

    it('31字は 400', () => {
      expect(() => parseExerciseInput(input('あ'.repeat(31)))).toThrow(BadRequestException);
    });

    it('見た目の1文字（絵文字など）は1字と数える。30個は通り、31個は 400', () => {
      expect(parseExerciseInput(input('😀'.repeat(30))).name).toBe('😀'.repeat(30));
      expect(() => parseExerciseInput(input('😀'.repeat(31)))).toThrow(BadRequestException);
    });
  });

  describe('名前の前後の空白', () => {
    it('前後の空白は取り除いて数える', () => {
      expect(parseExerciseInput(input('  Plank  ')).name).toBe('Plank');
    });

    it('空白だけは 0字と同じで 400', () => {
      expect(() => parseExerciseInput(input('   '))).toThrow(BadRequestException);
    });
  });

  describe('名前の型（文字列でないもの）', () => {
    it.each([[undefined], [null], [123], [{}], [['a']]])('%j は 400', (name) => {
      expect(() => parseExerciseInput(input(name))).toThrow(BadRequestException);
    });
  });

  describe('部位', () => {
    it.each(BODY_PARTS.map((p) => [p]))('%s は通る', (part) => {
      expect(parseExerciseInput(input('x', part)).bodyPart).toBe(part);
    });

    it.each([[undefined], [null], [''], ['Chest'], ['neck'], [1]])('%j は 400', (part) => {
      // input() は未指定の部位を chest で埋めるので、ここでは組み立て済みの値をそのまま渡す
      expect(() => parseExerciseInput({ name: 'x', bodyPart: part })).toThrow(BadRequestException);
    });
  });

  describe('入力そのものの型', () => {
    it.each([[undefined], [null], ['text'], [42]])('%j は 400', (raw) => {
      expect(() => parseExerciseInput(raw)).toThrow(BadRequestException);
    });
  });

  it('400 の応答は code=VALIDATION_ERROR と、項目ごとの理由を持つ', () => {
    try {
      parseExerciseInput(input('', 'neck'));
      expect.unreachable();
    } catch (err) {
      const body = (err as BadRequestException).getResponse() as { code: string; details: string[] };
      expect(body.code).toBe('VALIDATION_ERROR');
      expect(body.details).toHaveLength(2);
    }
  });
});
