import { BadRequestException } from '@nestjs/common';
import { isUuid } from '../common/uuid.js';

// 作れる種類（筋トレ・ラン・休み）
export const CREATABLE_KINDS = ['workout', 'run', 'rest'] as const;
export type CreatableKind = (typeof CREATABLE_KINDS)[number];

// 端末の時計は少しずれるので、未来は5分先まで受け付ける（docs/testing-design.md T-DATE-07。5分1秒は 400）
export const FUTURE_LIMIT_MS = 5 * 60 * 1000;

// ランの距離（m）と時間（秒）の範囲。0.1〜200km・1分〜24時間（docs/database-design.md run_details・T-RUN-01〜08）
export const DISTANCE_M_MIN = 100;
export const DISTANCE_M_MAX = 200_000;
export const DURATION_S_MIN = 60;
export const DURATION_S_MAX = 86_400;

// GPX のルート（GeoJSON の LineString。点は [経度, 緯度]）。点の数は 2〜3,000（docs/database-design.md run_details.route）
export const ROUTE_POINTS_MIN = 2;
export const ROUTE_POINTS_MAX = 3000;
export type RouteInput = { type: 'LineString'; coordinates: [number, number][] };

export type RunInput = { distanceM: number; durationS: number; route?: RouteInput };

const isInt = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;

const isFiniteIn = (v: unknown, abs: number): v is number => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= abs;

// route の検査。正しければ type と coordinates だけ取り出して返し（余計な項目は捨てる）、正しくなければ undefined
function parseRoute(raw: unknown): RouteInput | undefined {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return undefined;
  const r = raw as Record<string, unknown>;
  if (r.type !== 'LineString' || !Array.isArray(r.coordinates)) return undefined;
  const c = r.coordinates as unknown[];
  if (c.length < ROUTE_POINTS_MIN || c.length > ROUTE_POINTS_MAX) return undefined;
  const ok = c.every((p) => Array.isArray(p) && p.length === 2 && isFiniteIn(p[0], 180) && isFiniteIn(p[1], 90));
  return ok ? { type: 'LineString', coordinates: c as [number, number][] } : undefined;
}

// ISO 8601 の日時（タイムゾーンつき）。日付だけ・空白区切り・数値は受けない
const ISO = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])T([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(\.\d{1,3})?(Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/;

// 日時の文字列を Date にする。実在しない日付（2月30日など）は、JavaScript が3月2日に繰り上げてしまうので、年月日が元のままかを確かめる
export function parseIso(text: string): Date | undefined {
  const m = ISO.exec(text);
  if (!m) return undefined;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const calendar = new Date(Date.UTC(year, month - 1, day));
  if (calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day) return undefined;
  const at = new Date(text);
  return Number.isNaN(at.getTime()) ? undefined : at;
}

// 記録を作るときの入力検査（docs/design.md 4章 POST /records）。理由は項目ごとに集めて、1回で直せるようにする
export function parseRecordInput(raw: unknown, now: Date = new Date()): { id: string; kind: CreatableKind; recordedAt: Date; run?: RunInput } {
  const body = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  const details: string[] = [];

  const id = isUuid(body.id) ? body.id.toLowerCase() : undefined;
  if (!id) details.push('id: UUID で指定してください');

  const kind = (CREATABLE_KINDS as readonly unknown[]).includes(body.kind) ? (body.kind as CreatableKind) : undefined;
  if (!kind) details.push(`kind: ${CREATABLE_KINDS.join('・')} のどれかを指定してください`);

  const recordedAt = typeof body.recordedAt === 'string' ? parseIso(body.recordedAt) : undefined;
  if (!recordedAt) {
    details.push('recordedAt: ISO 8601 の日時（例: 2026-11-01T09:00:00+09:00）で指定してください');
  } else if (recordedAt.getTime() > now.getTime() + FUTURE_LIMIT_MS) {
    details.push('recordedAt: 未来の時刻は受け付けられません（5分先まで）');
  }

  // run は kind=run のときだけ（必須）。筋トレ・休みに付いていたら、取り違えを教えるため 400
  let run: RunInput | undefined;
  if (kind === 'run') {
    const r = typeof body.run === 'object' && body.run !== null && !Array.isArray(body.run) ? (body.run as Record<string, unknown>) : undefined;
    if (!r) {
      details.push('run: kind が run のときは { distanceM, durationS } を指定してください');
    } else {
      if (!isInt(r.distanceM, DISTANCE_M_MIN, DISTANCE_M_MAX)) details.push(`run.distanceM: ${DISTANCE_M_MIN}〜${DISTANCE_M_MAX} の整数（m）で指定してください`);
      if (!isInt(r.durationS, DURATION_S_MIN, DURATION_S_MAX)) details.push(`run.durationS: ${DURATION_S_MIN}〜${DURATION_S_MAX} の整数（秒）で指定してください`);
      // route は GPX を取り込んだときだけ付く。付いていて正しくなければ 400
      const route = r.route === undefined ? undefined : parseRoute(r.route);
      if (r.route !== undefined && !route) details.push(`run.route: GeoJSON の LineString（点は [経度, 緯度] で ${ROUTE_POINTS_MIN}〜${ROUTE_POINTS_MAX} 点）で指定してください`);
      if (details.length === 0) run = { distanceM: r.distanceM as number, durationS: r.durationS as number, ...(route ? { route } : {}) };
    }
  } else if (kind && body.run !== undefined) {
    details.push('run: kind が run のときだけ指定できます');
  }

  if (!id || !kind || !recordedAt || details.length > 0) {
    throw new BadRequestException({ code: 'VALIDATION_ERROR', message: '入力が正しくありません', details });
  }
  return run ? { id, kind, recordedAt, run } : { id, kind, recordedAt };
}
