import { BadRequestException } from '@nestjs/common';
import { encodeCursor } from '../records/list-input.js';
import { commentLength, parseCommentInput, parseFeedQuery, parseReactionInput } from './feed-input.js';
import { REST_STAMPS, STAMP_KEYS, stampFitsKind, WORKOUT_STAMPS } from './stamps.js';

const ID = '5f0e1c2a-3b4d-4e5f-8a9b-0c1d2e3f4a5b';

const detailsOf = (fn: () => unknown): string[] => {
  try {
    fn();
  } catch (err) {
    expect(err).toBeInstanceOf(BadRequestException);
    const body = (err as BadRequestException).getResponse() as { code: string; details: string[] };
    expect(body.code).toBe('VALIDATION_ERROR');
    return body.details;
  }
  return expect.unreachable();
};

// コメントの文字数（docs/testing-design.md 3-5 T-CMT-01〜07。50字はコードポイントで数える）
describe('parseCommentInput（コメントの本文 1〜50字）', () => {
  it.each<[string, string]>([
    ['T-CMT-02 下端 1字', 'a'],
    ['T-CMT-03 上端 50字（半角）', 'a'.repeat(50)],
    ['T-CMT-05 日本語 50字', 'あ'.repeat(50)],
    ['T-CMT-06 絵文字を含む 50字（💪は1字）', `${'あ'.repeat(49)}💪`],
    ['前後に空白があっても、文字があれば通る（削らずそのまま）', ' ナイス！ '],
  ])('%s は通り、本文はそのまま返る', (_name, body) => {
    expect(parseCommentInput({ id: ID, body })).toEqual({ id: ID, body });
  });

  it.each<[string, unknown, string]>([
    ['T-CMT-01 下端の外 0字（空）', '', 'body'],
    ['T-CMT-04 上端の外 51字', 'a'.repeat(51), 'body'],
    ['T-CMT-06 絵文字を含む 51字', `${'あ'.repeat(50)}💪`, 'body'],
    ['T-CMT-07 空白だけ', '   ', 'body'],
    ['全角空白だけ', '　　', 'body'],
    ['文字列でない', 123, 'body'],
    ['無い', undefined, 'body'],
  ])('%s は 400', (_name, body, field) => {
    const details = detailsOf(() => parseCommentInput({ id: ID, body }));
    expect(details.some((d) => d.startsWith(`${field}:`))).toBe(true);
  });

  it('JavaScript の .length で数えると絵文字は2になる文字を、1字として数える（50字ちょうど）', () => {
    const body = '💪'.repeat(50);
    expect(body.length).toBe(100);
    expect(commentLength(body)).toBe(50);
    expect(parseCommentInput({ id: ID, body }).body).toBe(body);
  });

  it('id が UUID でなければ 400。id と body の理由は1回で両方返る', () => {
    const details = detailsOf(() => parseCommentInput({ id: 'x', body: '' }));
    expect(details.map((d) => d.split(':')[0]).sort()).toEqual(['body', 'id']);
  });

  it('大文字の id は小文字にそろえる', () => {
    expect(parseCommentInput({ id: ID.toUpperCase(), body: 'a' }).id).toBe(ID);
  });
});

describe('parseReactionInput（スタンプ）', () => {
  it.each(STAMP_KEYS)('一覧のキー %s は通る', (stampKey) => {
    expect(parseReactionInput({ id: ID, stampKey })).toEqual({ id: ID, stampKey });
  });

  it.each([['like'], [''], ['NICE'], [null], [undefined], [1]])('T-STP-04 一覧にない stampKey %j は 400', (stampKey) => {
    const details = detailsOf(() => parseReactionInput({ id: ID, stampKey }));
    expect(details.some((d) => d.startsWith('stampKey:'))).toBe(true);
  });

  it('id が UUID でなければ 400', () => {
    expect(detailsOf(() => parseReactionInput({ id: 'x', stampKey: 'nice' }))[0]).toMatch(/^id:/);
  });
});

describe('stampFitsKind（スタンプと記録の種類の組み合わせ。T-STP-06）', () => {
  it.each(WORKOUT_STAMPS)('通常のスタンプ %s は 筋トレ・ランに付けられ、休みには付けられない', (k) => {
    expect(stampFitsKind(k, 'workout')).toBe(true);
    expect(stampFitsKind(k, 'run')).toBe(true);
    expect(stampFitsKind(k, 'rest')).toBe(false);
  });

  it.each(REST_STAMPS)('休み用のスタンプ %s は 休みに付けられ、筋トレ・ランには付けられない', (k) => {
    expect(stampFitsKind(k, 'rest')).toBe(true);
    expect(stampFitsKind(k, 'workout')).toBe(false);
    expect(stampFitsKind(k, 'run')).toBe(false);
  });
});

describe('parseFeedQuery（GET /feed）', () => {
  it('weekStart はその日を含む週の月曜に直す（水曜 → 月曜）', () => {
    expect(parseFeedQuery({ weekStart: '2026-10-28' }).weekStart).toBe('2026-10-26');
  });

  it('週の境界: 日曜 2026-11-01 は前の月曜（10-26）の週、月曜 2026-11-02 は新しい週', () => {
    expect(parseFeedQuery({ weekStart: '2026-11-01' }).weekStart).toBe('2026-10-26');
    expect(parseFeedQuery({ weekStart: '2026-11-02' }).weekStart).toBe('2026-11-02');
  });

  it.each([[undefined], [''], ['2026-02-30'], ['2026/10/26'], ['あした'], [20261026]])('weekStart %j は 400', (weekStart) => {
    expect(detailsOf(() => parseFeedQuery({ weekStart }))[0]).toMatch(/^weekStart:/);
  });

  it('cursor は前の応答の nextCursor だけ通る。壊れていれば 400', () => {
    const cursor = encodeCursor(new Date('2026-10-26T03:00:00.000Z'), ID);
    expect(parseFeedQuery({ weekStart: '2026-10-26', cursor }).cursor).toEqual({ recordedAt: new Date('2026-10-26T03:00:00.000Z'), id: ID });
    expect(parseFeedQuery({ weekStart: '2026-10-26' }).cursor).toBeUndefined();
    expect(detailsOf(() => parseFeedQuery({ weekStart: '2026-10-26', cursor: 'xxxx' }))[0]).toMatch(/^cursor:/);
  });

  it('weekStart と cursor の理由は1回で両方返る', () => {
    const details = detailsOf(() => parseFeedQuery({ weekStart: 'x', cursor: 'y' }));
    expect(details.map((d) => d.split(':')[0]).sort()).toEqual(['cursor', 'weekStart']);
  });
});
