import {
  clampReps,
  clampWeight,
  ghostDiff,
  initialDraft,
  nextSetNo,
  provisionalResult,
  shouldStartNewRecord,
  stepReps,
  stepWeight,
} from './record-flow';

const H = 60 * 60 * 1000;
const PREV = [
  { setNo: 1, weightKg: 40, reps: 10 },
  { setNo: 2, weightKg: 40, reps: 10 },
  { setNo: 3, weightKg: 40, reps: 8 },
];

describe('1回の運動の区切り（T-SPLIT-01〜03。3時間以上あいたら別の記録）', () => {
  const t0 = Date.parse('2026-11-02T10:00:00Z');
  it('まだセットが無ければ新しい記録', () => expect(shouldStartNewRecord(null, t0)).toBe(true));
  it('2時間59分は同じ記録（T-SPLIT-01）', () => expect(shouldStartNewRecord(t0, t0 + 3 * H - 60_000)).toBe(false));
  it('ちょうど3時間は別の記録（T-SPLIT-02）', () => expect(shouldStartNewRecord(t0, t0 + 3 * H)).toBe(true));
  it('日をまたいでも40分なら同じ記録（T-SPLIT-03）', () => {
    const a = Date.parse('2026-11-02T14:30:00Z'); // 日本時間 23:30
    expect(shouldStartNewRecord(a, a + 40 * 60_000)).toBe(false);
  });
});

describe('＋/− と範囲（回数 ±1・重量 ±2.5kg。T-SET-06・08・09・10・11）', () => {
  it('回数は ±1', () => {
    expect(stepReps(10, 1)).toBe(11);
    expect(stepReps(10, -1)).toBe(9);
  });
  it('回数は 1〜999 を超えない', () => {
    expect(stepReps(1, -1)).toBe(1);
    expect(stepReps(999, 1)).toBe(999);
  });
  it('重量は ±2.5kg', () => {
    expect(stepWeight(40, 1)).toBe(42.5);
    expect(stepWeight(40, -1)).toBe(37.5);
  });
  it('重量は 0〜500 を超えない（500 で「＋」を押しても 500）', () => {
    expect(stepWeight(0, -1)).toBe(0);
    expect(stepWeight(1, -1)).toBe(0);
    expect(stepWeight(500, 1)).toBe(500);
    expect(stepWeight(499, 1)).toBe(500);
  });
  it('直接打った値も範囲に収め、重量は 0.5 刻み・回数は整数にそろえる', () => {
    expect(clampWeight(501)).toBe(500);
    expect(clampWeight(-3)).toBe(0);
    expect(clampWeight(40.3)).toBe(40.5);
    expect(clampWeight(Number.NaN)).toBe(0);
    expect(clampReps(0)).toBe(1);
    expect(clampReps(1000)).toBe(999);
    expect(clampReps(10.6)).toBe(11);
    expect(clampReps(Number.NaN)).toBe(1);
  });
});

describe('最初に入る値（features.md 2.3。前回の同じセット番号 → 前回の最後のセット → お試し → 空）', () => {
  it('前回の同じセット番号の値が入る', () => {
    expect(initialDraft(PREV, 2, null)).toEqual({ draft: { weightKg: 40, reps: 10 }, ghost: PREV[1], source: 'previous' });
  });
  it('前回の同じ番号が無いときは、前回の最後のセット（前回3セットで4セット目）', () => {
    expect(initialDraft(PREV, 4, null)).toEqual({ draft: { weightKg: 40, reps: 8 }, ghost: PREV[2], source: 'previous' });
  });
  it('前回が無ければ、種目のお試し値（お試しの札を出す印）', () => {
    expect(initialDraft(undefined, 1, { weightKg: 25, reps: 12 })).toEqual({
      draft: { weightKg: 25, reps: 12 },
      ghost: { weightKg: 25, reps: 12 },
      source: 'trial',
    });
  });
  it('前回もお試しも無ければ、前回なし（0kg × 10回から。比べる相手は無い）', () => {
    expect(initialDraft(undefined, 1, null)).toEqual({ draft: { weightKg: 0, reps: 10 }, ghost: null, source: 'none' });
    expect(initialDraft([], 1, null).source).toBe('none');
  });
});

describe('セット番号', () => {
  it('消して穴があいても、いちばん大きい番号の次（番号の重複で 409 にならない）', () => {
    expect(nextSetNo([])).toBe(1);
    expect(nextSetNo([{ setNo: 1 }, { setNo: 3 }])).toBe(4);
  });
});

describe('ghostDiff（前回超え +N の N）', () => {
  it('重量が同じなら回数の差', () => expect(ghostDiff({ weightKg: 40, reps: 10 }, { weightKg: 40, reps: 11 })).toBe(1));
  it('重量が違えば 重量×回数 の差（45×9=405 は 40×10=400 を 5 上回る）', () =>
    expect(ghostDiff({ weightKg: 40, reps: 10 }, { weightKg: 45, reps: 9 })).toBe(5));
});

describe('仮表示の結果（共通の関数で出す。API の応答が正）', () => {
  it('前回の比べる相手が無ければ result は null・ベストでもない', () => {
    expect(provisionalResult(null, { weightKg: 40, reps: 10 }, null)).toEqual({ result: null, isPersonalBest: false });
  });
  it('上回り・同じ・下回り', () => {
    expect(provisionalResult(PREV[0], { weightKg: 40, reps: 11 }, 400).result).toBe('up');
    expect(provisionalResult(PREV[0], { weightKg: 40, reps: 10 }, 400).result).toBe('same');
    expect(provisionalResult(PREV[0], { weightKg: 40, reps: 9 }, 400).result).toBe('down');
  });
  it('過去最大の重量×回数を超えたらベスト。同じはベストでない', () => {
    expect(provisionalResult(PREV[0], { weightKg: 40, reps: 11 }, 400).isPersonalBest).toBe(true);
    expect(provisionalResult(PREV[0], { weightKg: 40, reps: 10 }, 400).isPersonalBest).toBe(false);
  });
  it('過去最大が無い（初めての種目）ときはベストにしない', () => {
    expect(provisionalResult(null, { weightKg: 40, reps: 99 }, null).isPersonalBest).toBe(false);
  });
});
