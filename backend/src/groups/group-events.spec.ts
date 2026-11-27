import { describe, expect, it } from 'vitest';
import { buildGroupEvents, EVENT_MAX } from './group-events.js';

const NOW = new Date('2026-11-27T12:00:00.000Z');
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 24 * 60 * 60 * 1000);
const m = (id: string, d: number) => ({ id, name: `名前${id}`, joinedAt: daysAgo(d) });

describe('buildGroupEvents（タイムラインの上の出来事）', () => {
  it('直近14日の参加だけを、新しい順に出す。作った人の参加は出さない', () => {
    const events = buildGroupEvents({ now: NOW, createdBy: 'a', members: [m('a', 3), m('b', 5), m('c', 1), m('d', 20)], mission: null });
    expect(events.map((e) => [e.kind, e.actorId])).toEqual([['joined', 'c'], ['joined', 'b']]);
  });

  it('ミッションを直した出来事が、参加と時刻の順に混ざる。直した人が退会していれば名前は null', () => {
    const events = buildGroupEvents({ now: NOW, createdBy: 'a', members: [m('b', 5)], mission: { at: daysAgo(2), by: null } });
    expect(events.map((e) => e.kind)).toEqual(['mission', 'joined']);
    expect(events[0]).toMatchObject({ actorId: null, actorName: null });
  });

  it('14日より前のミッション変更は出さない。最大5件', () => {
    expect(buildGroupEvents({ now: NOW, createdBy: null, members: [], mission: { at: daysAgo(15), by: { id: 'a', name: 'A' } } })).toEqual([]);
    const many = Array.from({ length: 8 }, (_, i) => m(`u${i}`, i + 1));
    expect(buildGroupEvents({ now: NOW, createdBy: null, members: many, mission: null })).toHaveLength(EVENT_MAX);
  });
});
