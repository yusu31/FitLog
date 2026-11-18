// GPS で走りを記録する（Web 版）の、純粋な計算だけを置く。位置の取得（watchPosition）・画面は components/run/gps-tracker.tsx。
// 出力は GPX 取り込み（parse-gpx.ts）と同じ GpxRun の形にして、保存の経路を共通にする。
import { haversineM, roundPosition, thinCoordinates, type GpxRun, type Position } from '@/lib/gpx/parse-gpx';
import { DISTANCE_M_MAX, DISTANCE_M_MIN, DURATION_S_MAX, DURATION_S_MIN } from '@/lib/run';

export const MAX_ACCURACY_M = 30; // これより精度の悪い点（誤差の円が大きい）は捨てる
export const MAX_SPEED_MPS = 11.1; // 時速40km。これより速い移動は GPS の飛びとみなす（ランでは出ない速さ）
export const MIN_STEP_M = 3; // これより小さい動きは、立ち止まっているときの GPS のゆれとして距離に足さない
export const JUMP_RESET_COUNT = 3; // 飛びが続けて起きたら、最初の点が外れていたとみなして今の位置を起点に取り直す

// ブラウザの GeolocationPosition から必要な値だけを取り出した形（時刻 t は ms）
export type GpsFix = { lon: number; lat: number; accuracyM: number; t: number };

export type TrackState = {
  points: Position[]; // 採用した点（[経度, 緯度]）
  distanceM: number; // 採用した点どうしの距離の合計（丸める前）
  anchor: { pos: Position; t: number } | null; // 距離の起点にしている直前の点。一時停止で外す
  rejectedJumps: number; // 飛びとして続けて捨てた数
};

export const emptyTrack = (): TrackState => ({ points: [], distanceM: 0, anchor: null, rejectedJumps: 0 });

// 1つの位置を足す。捨てる点は state をそのまま返す（同じ参照）
export function addFix(state: TrackState, fix: GpsFix): TrackState {
  if (!Number.isFinite(fix.accuracyM) || fix.accuracyM > MAX_ACCURACY_M) return state;
  const pos: Position = [fix.lon, fix.lat];
  const { anchor } = state;

  if (!anchor) return { points: [...state.points, pos], distanceM: state.distanceM, anchor: { pos, t: fix.t }, rejectedJumps: 0 };

  const step = haversineM(anchor.pos, pos);
  const dtS = (fix.t - anchor.t) / 1000;
  if (dtS <= 0) return state; // 時刻が戻った・同じ時刻の点は使わない
  if (step / dtS > MAX_SPEED_MPS) {
    const rejectedJumps = state.rejectedJumps + 1;
    // 起点そのものが外れていると、本当の位置がずっと「飛び」になって記録が止まる。続いたら取り直す（その間の距離は足さない）
    if (rejectedJumps >= JUMP_RESET_COUNT) return { ...state, points: [...state.points, pos], anchor: { pos, t: fix.t }, rejectedJumps: 0 };
    return { ...state, rejectedJumps };
  }
  if (step < MIN_STEP_M) return state.rejectedJumps === 0 ? state : { ...state, rejectedJumps: 0 };
  return { points: [...state.points, pos], distanceM: state.distanceM + step, anchor: { pos, t: fix.t }, rejectedJumps: 0 };
}

// 一時停止・再開のときに、起点を外す（止まっている間の移動を距離に足さないため）
export const breakSegment = (state: TrackState): TrackState => (state.anchor ? { ...state, anchor: null, rejectedJumps: 0 } : state);

// 動いていた時間（ms）。一時停止の間は数えない。pausedMs は一時停止の合計
export const movingMs = (startedAtMs: number, nowMs: number, pausedMs: number): number => Math.max(0, nowMs - startedAtMs - pausedMs);

export type FinishError = 'TOO_SHORT' | 'OUT_OF_RANGE';
export type FinishResult = { ok: true; value: GpxRun } | { ok: false; error: FinishError };

// 終了。距離（100m〜200km）と時間（1分〜24時間）が保存できる範囲かを確かめ、GPX 取り込みと同じ形にする
export function finishTrack(state: TrackState, startedAtMs: number, movingMilliseconds: number): FinishResult {
  if (state.points.length < 2) return { ok: false, error: 'TOO_SHORT' };
  const distanceM = Math.round(state.distanceM);
  const durationS = Math.round(movingMilliseconds / 1000);
  if (distanceM < DISTANCE_M_MIN || durationS < DURATION_S_MIN) return { ok: false, error: 'TOO_SHORT' };
  if (distanceM > DISTANCE_M_MAX || durationS > DURATION_S_MAX) return { ok: false, error: 'OUT_OF_RANGE' };
  return {
    ok: true,
    value: {
      distanceM,
      durationS,
      startedAt: new Date(startedAtMs).toISOString(),
      route: { type: 'LineString', coordinates: thinCoordinates(state.points).map(roundPosition) },
    },
  };
}
