// GPX の読み取り（F-14・features.md 2.10）。純粋な関数だけを置く。画面・通信は別の PR。
// XML の読み取りは @tmcw/togeojson。壊れた XML・線0本・サイズ上限・距離の範囲の検査は自前。
import { gpx } from '@tmcw/togeojson';
import { DISTANCE_M_MAX, DISTANCE_M_MIN, DURATION_S_MAX, DURATION_S_MIN } from '@/lib/run';

export const GPX_MAX_BYTES = 5 * 1024 * 1024; // 5MB（5,242,880。この値ちょうどは通す）
export const GPX_MAX_POINTS = 3_000; // 保存するルートの点の上限

export type GpxErrorCode = 'TOO_LARGE' | 'INVALID_XML' | 'NO_TRACK' | 'OUT_OF_RANGE';

// [経度, 緯度] の並び（GeoJSON と同じ）
export type Position = [number, number];
export type RouteLineString = { type: 'LineString'; coordinates: Position[] };

export type GpxRun = {
  distanceM: number; // 座標列から自前で算出した整数 m
  durationS: number | null; // 時刻があり、ランの範囲（60秒〜24時間）に収まるときだけ
  startedAt: string | null; // 最初の時刻（ISO 8601）。時刻が無いとき null
  route: RouteLineString; // 点は GPX_MAX_POINTS 以下に間引いた経路
};

export type GpxResult = { ok: true; value: GpxRun } | { ok: false; error: GpxErrorCode };

const EARTH_RADIUS_M = 6_371_008.8;
const toRad = (deg: number): number => (deg * Math.PI) / 180;

// 2点間の距離（ハーバーサイン）。m
export function haversineM(a: Position, b: Position): number {
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function pathLengthM(coords: Position[]): number {
  let sum = 0;
  for (let i = 1; i < coords.length; i++) sum += haversineM(coords[i - 1], coords[i]);
  return sum;
}

// 点を等間隔に間引く。最初と最後は必ず残す。上限以下ならそのまま
export function thinCoordinates(coords: Position[], max: number = GPX_MAX_POINTS): Position[] {
  if (coords.length <= max) return coords;
  const out: Position[] = [];
  for (let i = 0; i < max; i++) out.push(coords[Math.round((i * (coords.length - 1)) / (max - 1))]);
  return out;
}

const fail = (error: GpxErrorCode): GpxResult => ({ ok: false, error });

const isValidPosition = (p: unknown): p is Position =>
  Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]) && Math.abs(p[1]) <= 90 && Math.abs(p[0]) <= 180;

// text は GPX の文字列、byteLength はファイルのバイト数（File.size）。
export function parseGpx(text: string, byteLength: number): GpxResult {
  if (byteLength > GPX_MAX_BYTES) return fail('TOO_LARGE');
  if (text.trim() === '') return fail('INVALID_XML');

  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(text, 'application/xml');
  } catch {
    return fail('INVALID_XML');
  }
  if (doc.getElementsByTagName('parsererror').length > 0 || doc.documentElement?.localName !== 'gpx') {
    return fail('INVALID_XML');
  }

  // 複数トラック・複数セグメントは、出てきた順に1本につなぐ
  const coords: Position[] = [];
  const times: (string | undefined)[] = [];
  for (const feature of gpx(doc).features) {
    const g = feature.geometry;
    if (!g) continue;
    const rawTimes = (feature.properties?.coordinateProperties as { times?: unknown } | undefined)?.times;
    const lines: unknown[][] =
      g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : [];
    const timeLines: unknown[] = g.type === 'LineString' ? [rawTimes] : Array.isArray(rawTimes) ? rawTimes : [];
    lines.forEach((line, li) => {
      const t = Array.isArray(timeLines[li]) ? (timeLines[li] as (string | null)[]) : [];
      line.forEach((p, i) => {
        if (!isValidPosition(p)) return;
        coords.push([p[0], p[1]]);
        times.push(t[i] ?? undefined);
      });
    });
  }
  if (coords.length < 2) return fail('NO_TRACK'); // 線が0本・点が1つだけ

  const distanceM = Math.round(pathLengthM(coords));
  if (distanceM < DISTANCE_M_MIN || distanceM > DISTANCE_M_MAX) return fail('OUT_OF_RANGE');

  // 時刻: 最初の時刻が読めれば開始日時にする。所要秒は最初と最後がそろい、ランの範囲に収まるときだけ
  const first = times.find((t) => t !== undefined);
  const last = [...times].reverse().find((t) => t !== undefined);
  const t0 = first ? Date.parse(first) : NaN;
  const t1 = last ? Date.parse(last) : NaN;
  let durationS: number | null = null;
  let startedAt: string | null = null;
  if (Number.isFinite(t0)) {
    startedAt = new Date(t0).toISOString();
    if (Number.isFinite(t1)) {
      const d = Math.round((t1 - t0) / 1000);
      if (d >= DURATION_S_MIN && d <= DURATION_S_MAX) durationS = d;
    }
  }

  return {
    ok: true,
    value: { distanceM, durationS, startedAt, route: { type: 'LineString', coordinates: thinCoordinates(coords) } },
  };
}
