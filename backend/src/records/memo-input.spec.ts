import { BadRequestException } from '@nestjs/common';
import { NOTE_MAX, parseMemoInput, RPE_MAX, RPE_MIN } from './memo-input.js';

// 記録のメモ・きつさ（F5）の入力検査。メモは 0〜200 字（前後の空白は除く・空は消す扱い）、きつさは 1〜10 の整数。
// 境界値: きつさ 0・1・10・11・1.5、メモ 200 字・201 字。null は「消す」、項目が無ければ「触らない」
const rejects = (raw: unknown) => expect(() => parseMemoInput(raw)).toThrow(BadRequestException);

describe('parseMemoInput（メモ・きつさの入力検査）', () => {
  it('メモときつさの両方を受け取る', () => {
    expect(parseMemoInput({ note: '肩が重かった', rpe: 7 })).toEqual({ note: '肩が重かった', rpe: 7 });
  });

  it('片方だけなら、もう一方は触らない（項目を含めない）', () => {
    expect(parseMemoInput({ rpe: 5 })).toEqual({ rpe: 5 });
    expect(parseMemoInput({ note: 'a' })).toEqual({ note: 'a' });
  });

  it('null は「消す」。メモが空白だけのときも消す（null にする）', () => {
    expect(parseMemoInput({ note: null, rpe: null })).toEqual({ note: null, rpe: null });
    expect(parseMemoInput({ note: '   ' })).toEqual({ note: null });
  });

  it('メモの前後の空白は除く', () => {
    expect(parseMemoInput({ note: '  いい感じ  ' })).toEqual({ note: 'いい感じ' });
  });

  it.each<[string, number, boolean]>([
    ['下端 1', RPE_MIN, true],
    ['上端 10', RPE_MAX, true],
    ['下端の外 0', 0, false],
    ['上端の外 11', 11, false],
    ['小数 1.5', 1.5, false],
  ])('きつさ %s', (_label, rpe, ok) => {
    if (ok) expect(parseMemoInput({ rpe })).toEqual({ rpe });
    else rejects({ rpe });
  });

  it('きつさは数（文字列の "7" は受けない）', () => rejects({ rpe: '7' }));

  it('メモは 200 字まで（日本語もコードポイントで数える）。201 字は拒否', () => {
    expect(parseMemoInput({ note: 'あ'.repeat(NOTE_MAX) })).toEqual({ note: 'あ'.repeat(NOTE_MAX) });
    rejects({ note: 'あ'.repeat(NOTE_MAX + 1) });
  });

  it('メモは文字列だけ', () => rejects({ note: 5 }));

  it('何も変えない入力（空のオブジェクト・オブジェクトでない）は拒否', () => {
    rejects({});
    rejects(null);
    rejects('x');
  });
});
