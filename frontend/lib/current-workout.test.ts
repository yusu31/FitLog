import { activeRecordId, recordForNextSet, resetCurrentWorkout } from './current-workout';

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
