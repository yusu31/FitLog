import { describe, expect, it } from 'vitest';
import {
  addFix,
  breakSegment,
  emptyTrack,
  finishTrack,
  JUMP_RESET_COUNT,
  MAX_ACCURACY_M,
  movingMs,
  type GpsFix,
  type TrackState,
} from './track';

// 経線（経度0）に沿って北へ進むと、距離は R × 緯度差(rad)。期待値を手で決められる
const M_PER_DEG = (Math.PI / 180) * 6_371_008.8;
const fixAt = (northM: number, tSec: number, accuracyM = 5): GpsFix => ({ lon: 0, lat: northM / M_PER_DEG, accuracyM, t: tSec * 1000 });
const feed = (state: TrackState, ...fixes: GpsFix[]): TrackState => fixes.reduce(addFix, state);

describe('addFix: 精度と飛びの検査', () => {
  it('最初の点は採用する（距離は0）', () => {
    const s = feed(emptyTrack(), fixAt(0, 0));
    expect(s.points).toHaveLength(1);
    expect(s.distanceM).toBe(0);
  });

  it(`精度が ${MAX_ACCURACY_M}m より悪い点は捨てる（ちょうど ${MAX_ACCURACY_M}m は採用）`, () => {
    const s0 = feed(emptyTrack(), fixAt(0, 0));
    expect(addFix(s0, fixAt(20, 5, MAX_ACCURACY_M + 1))).toBe(s0);
    expect(addFix(s0, fixAt(20, 5, MAX_ACCURACY_M)).points).toHaveLength(2);
    expect(addFix(s0, { ...fixAt(20, 5), accuracyM: NaN })).toBe(s0);
  });

  it('距離は点どうしの距離の合計（北へ 20m・20m で 40m）', () => {
    const s = feed(emptyTrack(), fixAt(0, 0), fixAt(20, 5), fixAt(40, 10));
    expect(s.distanceM).toBeCloseTo(40, 1);
  });

  it('立ち止まっているときのゆれ（3m 未満）は距離に足さない', () => {
    const s = feed(emptyTrack(), fixAt(0, 0), fixAt(1, 2), fixAt(2, 4), fixAt(2.9, 6));
    expect(s.points).toHaveLength(1);
    expect(s.distanceM).toBe(0);
  });

  it('時速40kmを超える移動（1秒で 100m）は飛びとして捨てる', () => {
    const s0 = feed(emptyTrack(), fixAt(0, 0), fixAt(10, 5));
    const s1 = addFix(s0, fixAt(110, 6));
    expect(s1.points).toHaveLength(2);
    expect(s1.distanceM).toBeCloseTo(10, 1);
    expect(s1.rejectedJumps).toBe(1);
  });

  it('飛びのあとに元の道へ戻ったら、起点は外れていないので続きを足す', () => {
    const s = feed(emptyTrack(), fixAt(0, 0), fixAt(10, 5), fixAt(500, 6), fixAt(20, 10));
    expect(s.distanceM).toBeCloseTo(20, 1);
    expect(s.rejectedJumps).toBe(0);
  });

  it(`飛びが ${JUMP_RESET_COUNT} 回続いたら、最初の点が外れていたとみなして取り直す（その間の距離は足さない）`, () => {
    // 最初の点が 5km 北にずれていた。以降は本当の位置 0m 付近が「飛び」に見え続ける
    let s = feed(emptyTrack(), fixAt(5000, 0));
    s = feed(s, fixAt(0, 5), fixAt(5, 10));
    expect(s.points).toHaveLength(1);
    s = feed(s, fixAt(10, 15));
    expect(s.anchor?.pos[1]).toBeCloseTo(10 / M_PER_DEG, 9);
    expect(s.distanceM).toBe(0);
    s = feed(s, fixAt(30, 20));
    expect(s.distanceM).toBeCloseTo(20, 1);
  });

  it('時刻が戻った点・同じ時刻の点は使わない', () => {
    const s0 = feed(emptyTrack(), fixAt(0, 10));
    expect(addFix(s0, fixAt(20, 10))).toBe(s0);
    expect(addFix(s0, fixAt(20, 9))).toBe(s0);
  });
});

describe('一時停止と時間', () => {
  it('一時停止で起点を外すと、止まっている間に動いた分（200m）は距離に足さない', () => {
    let s = feed(emptyTrack(), fixAt(0, 0), fixAt(20, 5));
    s = breakSegment(s);
    s = feed(s, fixAt(220, 600), fixAt(240, 605));
    expect(s.distanceM).toBeCloseTo(40, 1);
    expect(s.points).toHaveLength(4); // 経路には全部残る
  });

  it('動いていた時間は、一時停止の合計を引く（10分走って2分止まったら8分）', () => {
    expect(movingMs(0, 600_000, 120_000)).toBe(480_000);
    expect(movingMs(0, 1000, 5000)).toBe(0); // 負にならない
  });
});

describe('finishTrack: 保存できる形にする', () => {
  const START = Date.parse('2026-11-19T06:00:00Z');
  // 北へ 150m（30m ずつ）
  const ok = feed(emptyTrack(), fixAt(0, 0), fixAt(30, 10), fixAt(60, 20), fixAt(90, 30), fixAt(120, 40), fixAt(150, 50));

  it('距離（整数 m）・時間（整数秒）・開始時刻（ISO）・route（LineString）を GPX 取り込みと同じ形で返す', () => {
    const r = finishTrack(ok, START, 90_000);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.distanceM).toBe(150);
    expect(r.value.durationS).toBe(90);
    expect(r.value.startedAt).toBe('2026-11-19T06:00:00.000Z');
    expect(r.value.route.type).toBe('LineString');
    expect(r.value.route.coordinates).toHaveLength(6);
  });

  it('点が2つ未満・100m 未満・1分未満は TOO_SHORT', () => {
    expect(finishTrack(emptyTrack(), START, 90_000)).toEqual({ ok: false, error: 'TOO_SHORT' });
    expect(finishTrack(feed(emptyTrack(), fixAt(0, 0), fixAt(50, 10)), START, 90_000)).toEqual({ ok: false, error: 'TOO_SHORT' });
    expect(finishTrack(ok, START, 59_000)).toEqual({ ok: false, error: 'TOO_SHORT' });
    expect(finishTrack(ok, START, 60_000).ok).toBe(true); // ちょうど1分は通す
  });

  it('24時間を超えたら OUT_OF_RANGE', () => {
    expect(finishTrack(ok, START, 86_401_000)).toEqual({ ok: false, error: 'OUT_OF_RANGE' });
  });

  it('座標は小数6桁に丸める', () => {
    const r = finishTrack(ok, START, 90_000);
    if (!r.ok) throw new Error('unreachable');
    for (const [lon, lat] of r.value.route.coordinates) {
      expect(Math.round(lon * 1e6) / 1e6).toBe(lon);
      expect(Math.round(lat * 1e6) / 1e6).toBe(lat);
    }
  });
});
