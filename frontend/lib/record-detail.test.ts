import { setOutcomes } from './record-detail';

const s = (setNo: number, weightKg: number, reps: number) => ({ setNo, weightKg, reps });

describe('setOutcomes（セットごとのゴーストの結果とベスト）', () => {
  it('セットが0件なら空', () => {
    expect(setOutcomes([], [s(1, 40, 10)], 400)).toEqual([]);
  });

  it('前回が無い（null）なら結果は null で、ベストも比べる過去が無ければ付かない', () => {
    expect(setOutcomes([s(1, 40, 10)], null, null)).toEqual([{ result: null, diff: 0, isBest: false }]);
  });

  it('同じ番号の前回のセットと比べる（上回り・同じ・下回り。重量が同じなら回数の差）', () => {
    const out = setOutcomes([s(1, 40, 12), s(2, 40, 10), s(3, 40, 8)], [s(1, 40, 10), s(2, 40, 10), s(3, 40, 10)], 1000);
    expect(out.map((o) => [o.result, o.diff])).toEqual([
      ['up', 2],
      ['same', 0],
      ['down', -2],
    ]);
  });

  it('重量が違えば重量×回数の差を出す', () => {
    const [o] = setOutcomes([s(1, 45, 10)], [s(1, 40, 10)], 1000);
    expect(o).toMatchObject({ result: 'up', diff: 50 });
  });

  it('前回より多くセットした分（同じ番号が前回に無い）は結果なし', () => {
    const out = setOutcomes([s(1, 40, 10), s(2, 40, 10)], [s(1, 40, 10)], 1000);
    expect(out[1].result).toBeNull();
  });

  it('自己ベストは「過去の最大を超えたとき」だけ。同じ値は付かない（境界）', () => {
    expect(setOutcomes([s(1, 40, 10)], null, 400)[0].isBest).toBe(false); // 400 = 400
    expect(setOutcomes([s(1, 40, 11)], null, 400)[0].isBest).toBe(true); // 440 > 400
  });

  it('同じ記録の前のセットも「過去」に数える（2セット目は1セット目を超えたらベスト）', () => {
    const out = setOutcomes([s(1, 40, 10), s(2, 40, 11), s(3, 40, 11)], null, null);
    expect(out.map((o) => o.isBest)).toEqual([false, true, false]);
  });
});
