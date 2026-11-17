import { toRoutineSets } from './routine-sets.js';

const A = 'aaaaaaaa-0000-4000-8000-000000000001';
const B = 'bbbbbbbb-0000-4000-8000-000000000002';

// 記録のセットをルーティンの行にする（F3）。種目の並びは最初に出てきた順、セット番号は種目ごとに1から振り直す
describe('toRoutineSets（記録のセット → ルーティンの行）', () => {
  it('種目の並びは最初にセットを足した順（後から足した種目が2番目）', () => {
    const rows = toRoutineSets('r', [
      { exerciseId: B, setNo: 1, weightKg: '60.0', reps: 10 },
      { exerciseId: A, setNo: 1, weightKg: '20.0', reps: 12 },
      { exerciseId: B, setNo: 2, weightKg: '60.0', reps: 8 },
    ]);
    expect(rows.map((r) => [r.exerciseId, r.position, r.setNo])).toEqual([
      [B, 1, 1],
      [B, 1, 2],
      [A, 2, 1],
    ]);
  });

  it('途中のセットを消した記録（1・3）は、1・2 に振り直す。重量・回数はそのまま', () => {
    const rows = toRoutineSets('r', [
      { exerciseId: A, setNo: 3, weightKg: '42.5', reps: 6 },
      { exerciseId: A, setNo: 1, weightKg: '40.0', reps: 10 },
    ]);
    expect(rows.map((r) => [r.setNo, r.weightKg, r.reps])).toEqual([
      [1, '40.0', 10],
      [2, '42.5', 6],
    ]);
  });
});
