import { summarizeStamps } from './stamps.js';

// スタンプの集計（足跡 GET /feed と一覧 GET /records/{id}/reactions で共通）。押した人は押した順（行の並び）のまま返す（A04-2）
const row = (id: string, userId: string, userName: string, stampKey: string) => ({ id, userId, userName, stampKey });

describe('summarizeStamps（スタンプごとの数・自分の id・押した人）', () => {
  const rows = [row('r1', 'u-hanako', 'はなこ', 'nice'), row('r2', 'me', 'わたし', 'nice'), row('r3', 'u-taro', 'たろう', 'fire')];

  it('スタンプごとに数と、押した人（id と名前）を押した順に返す', () => {
    expect(summarizeStamps(rows, 'me')).toEqual([
      { stampKey: 'nice', count: 2, mine: 'r2', by: [{ id: 'u-hanako', name: 'はなこ' }, { id: 'me', name: 'わたし' }] },
      { stampKey: 'fire', count: 1, mine: null, by: [{ id: 'u-taro', name: 'たろう' }] },
    ]);
  });
  it('付いていないスタンプは出さない・スタンプの一覧の順に並べる', () => {
    expect(summarizeStamps([row('r1', 'u1', 'a', 'smile'), row('r2', 'u2', 'b', 'nice')], 'me').map((s) => s.stampKey)).toEqual(['nice', 'smile']);
    expect(summarizeStamps([], 'me')).toEqual([]);
  });
});
