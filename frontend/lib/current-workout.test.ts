import { activeRecordId, bestCountOf, bestNamesOf, endCurrentWorkout, noteBest, recordForNextSet, resetCurrentWorkout } from './current-workout';

const H = 60 * 60 * 1000;
const t0 = Date.parse('2026-11-02T10:00:00Z');

beforeEach(() => resetCurrentWorkout());

describe('いま記録している筋トレの記録', () => {
  it('最初のセットで新しい記録、2時間59分後のセットは同じ記録', () => {
    const a = recordForNextSet(t0);
    const b = recordForNextSet(t0 + 3 * H - 60_000);
    expect(a.isNew).toBe(true);
    expect(b).toEqual({ recordId: a.recordId, isNew: false });
  });

  it('最後のセットからちょうど3時間で別の記録（T-SPLIT-02）。間隔は直前のセットから数える', () => {
    const a = recordForNextSet(t0);
    const b = recordForNextSet(t0 + 2 * H);
    const c = recordForNextSet(t0 + 4 * H + 59 * 60_000); // 直前（b）から 2時間59分
    expect(c.recordId).toBe(a.recordId);
    const d = recordForNextSet(t0 + 8 * H);
    expect(d.isNew).toBe(true);
    expect(d.recordId).not.toBe(b.recordId);
  });

  it('きのうの分は、今日の記録とは別に持つ（きのうの入力中に今日の記録へセットが継ぎ足されない。F-21）', () => {
    const today = recordForNextSet(t0);
    const yesterday = recordForNextSet(t0 + 60_000, 'yesterday');
    expect(yesterday.isNew).toBe(true);
    expect(yesterday.recordId).not.toBe(today.recordId);
    expect(recordForNextSet(t0 + 120_000, 'yesterday')).toEqual({ recordId: yesterday.recordId, isNew: false });
    expect(recordForNextSet(t0 + 180_000)).toEqual({ recordId: today.recordId, isNew: false });
    expect(activeRecordId(t0 + 200_000, 'yesterday')).toBe(yesterday.recordId);
  });

  it('画面を開いたとき、3時間以内なら続きの記録があり、過ぎていれば無い', () => {
    expect(activeRecordId(t0)).toBeNull();
    const a = recordForNextSet(t0);
    expect(activeRecordId(t0 + H)).toBe(a.recordId);
    expect(activeRecordId(t0 + 3 * H)).toBeNull();
  });
});

// N2: ページを読み直すとメモリは消える。サーバーが「記録中」と返した記録を、続きの記録として使う
describe('サーバーが返した「記録中」の記録を使う（N2）', () => {
  it('メモリが空でも、サーバーの記録中があれば、それが続きの記録になり、新しい記録は作らない', () => {
    expect(activeRecordId(t0, 'today', 'srv')).toBe('srv');
    expect(recordForNextSet(t0, 'today', 'srv')).toEqual({ recordId: 'srv', isNew: false });
    // 一度使ったら、以降はメモリが持つ（サーバーの答えが無くても同じ記録）
    expect(recordForNextSet(t0 + 60_000)).toEqual({ recordId: 'srv', isNew: false });
  });

  it('メモリの記録が3時間以上前でも、サーバーが別の記録を記録中と言えば、サーバーを正とする', () => {
    recordForNextSet(t0);
    expect(activeRecordId(t0 + 4 * H, 'today', 'srv')).toBe('srv');
    expect(recordForNextSet(t0 + 4 * H, 'today', 'srv')).toEqual({ recordId: 'srv', isNew: false });
  });

  it('サーバーの記録中が無く、メモリも空なら新しい記録', () => {
    expect(activeRecordId(t0, 'today', null)).toBeNull();
    expect(recordForNextSet(t0, 'today', null).isNew).toBe(true);
  });

  it('きのうの分には、サーバーの記録中を使わない（今日の記録に混ざらない）', () => {
    expect(activeRecordId(t0, 'yesterday', 'srv')).toBeNull();
    expect(recordForNextSet(t0, 'yesterday', 'srv').isNew).toBe(true);
  });
});

describe('「今日はここまで」（N1）', () => {
  it('終えると、続きの記録は無くなり、次のセットは新しい記録になる。きのうの分は残る', () => {
    const a = recordForNextSet(t0);
    const y = recordForNextSet(t0, 'yesterday');
    endCurrentWorkout();
    expect(activeRecordId(t0 + 60_000)).toBeNull();
    const b = recordForNextSet(t0 + 60_000);
    expect(b.isNew).toBe(true);
    expect(b.recordId).not.toBe(a.recordId);
    expect(activeRecordId(t0 + 60_000, 'yesterday')).toBe(y.recordId);
  });

  it('自己ベストの数を、記録ごとに数える（終了のまとめ用）。終えても数は残り、別の記録とは混ざらない', () => {
    noteBest('a');
    noteBest('a');
    noteBest('b');
    expect(bestCountOf('a')).toBe(2);
    expect(bestCountOf('b')).toBe(1);
    expect(bestCountOf('none')).toBe(0);
    resetCurrentWorkout();
    expect(bestCountOf('a')).toBe(0);
  });

  it('自己ベストが出た種目名を、記録ごとに重複なしで持つ', () => {
    noteBest('a', 'スクワット');
    noteBest('a', 'スクワット');
    noteBest('a', 'ベンチプレス');
    noteBest('b');
    expect(bestNamesOf('a')).toEqual(['スクワット', 'ベンチプレス']);
    expect(bestNamesOf('b')).toEqual([]);
    resetCurrentWorkout();
    expect(bestNamesOf('a')).toEqual([]);
  });
});
