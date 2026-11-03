import { describe, expect, it } from 'vitest';
import { GPX_MESSAGES } from '@/lib/messages';
import { GPX_MAX_BYTES, GPX_MAX_POINTS, haversineM, parseGpx, thinCoordinates, type Position } from './parse-gpx';

// 経線（経度0）に沿って北へ進むと、距離は R × 緯度差(rad) にちょうどなる。テストの期待値を手で決められる
const M_PER_DEG = (Math.PI / 180) * 6_371_008.8;
const latFor = (m: number): number => m / M_PER_DEG;

const pt = (lat: number, time?: string, lon = 0): string =>
  `<trkpt lat="${lat}" lon="${lon}">${time ? `<time>${time}</time>` : ''}</trkpt>`;
const wrap = (body: string, attrs = 'version="1.1" creator="t" xmlns="http://www.topografix.com/GPX/1/1"'): string =>
  `<?xml version="1.0"?><gpx ${attrs}>${body}</gpx>`;
const trk = (...segs: string[]): string => `<trk>${segs.map((s) => `<trkseg>${s}</trkseg>`).join('')}</trk>`;
// 距離 m を2点で作る
const twoPoints = (m: number, t0?: string, t1?: string): string => wrap(trk(pt(0, t0) + pt(latFor(m), t1)));
const parse = (text: string) => parseGpx(text, new TextEncoder().encode(text).length);

describe('parseGpx: 正常系', () => {
  it('距離・所要秒・開始日時・経路を返す', () => {
    const r = parse(twoPoints(5000, '2025-05-01T06:00:00Z', '2025-05-01T06:30:00Z'));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.distanceM).toBe(5000);
    expect(r.value.durationS).toBe(1800);
    expect(r.value.startedAt).toBe('2025-05-01T06:00:00.000Z');
    expect(r.value.route.type).toBe('LineString');
    expect(r.value.route.coordinates).toHaveLength(2);
    expect(r.value.route.coordinates[0]).toEqual([0, 0]);
  });

  it('時刻が無いときは所要秒・開始日時が null（距離とルートは読める）', () => {
    const r = parse(twoPoints(3000));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.durationS).toBeNull();
      expect(r.value.startedAt).toBeNull();
      expect(r.value.distanceM).toBe(3000);
    }
  });

  it('最初の点にだけ時刻があるとき、開始日時は出るが所要秒は null', () => {
    const r = parse(twoPoints(3000, '2025-05-01T06:00:00Z'));
    expect(r.ok && r.value.startedAt).toBe('2025-05-01T06:00:00.000Z');
    expect(r.ok && r.value.durationS).toBeNull();
  });

  it('時刻が逆転して所要秒が範囲外のときは所要秒を null にする（距離は残る）', () => {
    const r = parse(twoPoints(3000, '2025-05-01T07:00:00Z', '2025-05-01T06:00:00Z'));
    expect(r.ok && r.value.durationS).toBeNull();
  });

  it('昔の日付の GPX は、その日時をそのまま返す（日付の扱いは呼ぶ側）', () => {
    const r = parse(twoPoints(2000, '2019-01-02T03:04:05Z', '2019-01-02T03:24:05Z'));
    expect(r.ok && r.value.startedAt).toBe('2019-01-02T03:04:05.000Z');
  });

  it('複数トラック・複数セグメントは出てきた順に1本につなぐ', () => {
    const a = pt(0, '2025-05-01T06:00:00Z') + pt(latFor(1000), '2025-05-01T06:05:00Z');
    const b = pt(latFor(1000), '2025-05-01T06:10:00Z') + pt(latFor(2500), '2025-05-01T06:20:00Z');
    const r = parse(wrap(trk(a) + trk(b)));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.route.coordinates).toHaveLength(4);
    expect(r.value.distanceM).toBe(2500);
    expect(r.value.durationS).toBe(1200);
  });

  it('名前空間つき（1.1・1.0）・名前空間なしでも読める', () => {
    expect(parse(wrap(trk(pt(0) + pt(latFor(1500))), 'version="1.1" creator="t"')).ok).toBe(true);
    expect(parse(wrap(trk(pt(0) + pt(latFor(1500))), 'version="1.0" creator="t" xmlns="http://www.topografix.com/GPX/1/0"')).ok).toBe(true);
  });

  it('既知の限界: gpx 要素に接頭辞（g:gpx）がある GPX は線を拾えず NO_TRACK になる（togeojson の仕様）', () => {
    const prefixed = `<g:gpx xmlns:g="http://www.topografix.com/GPX/1/1" version="1.1" creator="t"><g:trk><g:trkseg><g:trkpt lat="0" lon="0"/><g:trkpt lat="${latFor(1500)}" lon="0"/></g:trkseg></g:trk></g:gpx>`;
    expect(parse(prefixed)).toEqual({ ok: false, error: 'NO_TRACK' });
  });

  it('点が 3,000 を超えるときは間引き、最初と最後は残す。距離は元の点で出す', () => {
    const n = 10_001;
    const total = 10_000;
    const pts = Array.from({ length: n }, (_, i) => pt(latFor((total * i) / (n - 1)))).join('');
    const r = parse(wrap(trk(pts)));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.route.coordinates).toHaveLength(GPX_MAX_POINTS);
    expect(r.value.route.coordinates[0]).toEqual([0, 0]);
    expect(r.value.route.coordinates[GPX_MAX_POINTS - 1][1]).toBeCloseTo(latFor(total), 9);
    expect(r.value.distanceM).toBe(10_000);
  });
});

describe('parseGpx: サイズの上限（境界値）', () => {
  const ok = twoPoints(1000);
  it('5MB ちょうどは通す', () => {
    expect(parseGpx(ok, GPX_MAX_BYTES).ok).toBe(true);
  });
  it('5MB + 1 バイトは TOO_LARGE（中身を読む前に断る）', () => {
    expect(parseGpx(ok, GPX_MAX_BYTES + 1)).toEqual({ ok: false, error: 'TOO_LARGE' });
    expect(parseGpx('<<壊れた', GPX_MAX_BYTES + 1)).toEqual({ ok: false, error: 'TOO_LARGE' });
  });
});

describe('parseGpx: 距離の範囲（境界値）', () => {
  const dist = (m: number) => {
    const r = parse(twoPoints(m));
    return r.ok ? r.value.distanceM : r.error;
  };
  it('99m は OUT_OF_RANGE', () => expect(dist(99)).toBe('OUT_OF_RANGE'));
  it('100m は通る', () => expect(dist(100)).toBe(100));
  it('200,000m は通る', () => expect(dist(200_000)).toBe(200_000));
  it('200,001m は OUT_OF_RANGE', () => expect(dist(200_001)).toBe('OUT_OF_RANGE'));
  it('2点が同じ場所（0m）は OUT_OF_RANGE', () => expect(parse(wrap(trk(pt(0) + pt(0)))).ok).toBe(false));
});

describe('parseGpx: エラー', () => {
  const err = (text: string) => {
    const r = parse(text);
    return r.ok ? 'ok' : r.error;
  };
  it('空文字・空白だけは INVALID_XML', () => {
    expect(err('')).toBe('INVALID_XML');
    expect(err('  \n ')).toBe('INVALID_XML');
  });
  it('壊れた XML は INVALID_XML', () => {
    expect(err('<gpx><trk><trkseg>')).toBe('INVALID_XML');
    expect(err('これは GPX ではありません')).toBe('INVALID_XML');
  });
  it('XML だが gpx ではないものは INVALID_XML', () => {
    expect(err('<html><body>hi</body></html>')).toBe('INVALID_XML');
  });
  it('トラックが0本は NO_TRACK', () => {
    expect(err(wrap(''))).toBe('NO_TRACK');
    expect(err(wrap('<wpt lat="0" lon="0"/>'))).toBe('NO_TRACK');
  });
  it('点が1つだけは NO_TRACK', () => {
    expect(err(wrap(trk(pt(0))))).toBe('NO_TRACK');
  });
  it('範囲外の座標の点は無視する（緯度 91 は読まない）', () => {
    expect(err(wrap(trk(pt(0) + pt(91))))).toBe('NO_TRACK');
  });
  it('エラーの種類ごとに日本語の文言がある', () => {
    for (const code of ['TOO_LARGE', 'INVALID_XML', 'NO_TRACK', 'OUT_OF_RANGE'] as const) {
      expect(GPX_MESSAGES[code].length).toBeGreaterThan(0);
    }
  });
});

describe('haversineM・thinCoordinates', () => {
  it('赤道上の経度1度は約 111.19km', () => {
    expect(haversineM([0, 0], [1, 0])).toBeCloseTo(111_194.9, 0);
  });
  it('上限以下の点は間引かない', () => {
    const c: Position[] = [[0, 0], [0, 1], [0, 2]];
    expect(thinCoordinates(c, 3)).toBe(c);
  });
  it('上限を超えると上限ちょうどにし、最初と最後を残す', () => {
    const c: Position[] = Array.from({ length: 11 }, (_, i) => [0, i]);
    const t = thinCoordinates(c, 4);
    expect(t).toHaveLength(4);
    expect(t[0]).toEqual([0, 0]);
    expect(t[3]).toEqual([0, 10]);
  });
});
