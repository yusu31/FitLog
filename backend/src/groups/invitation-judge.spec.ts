import { judgeInvitation, type InvitationFacts } from './invitation-judge.js';

// 招待リンクで参加できるかの判定（docs/design.md 7章・docs/testing-design.md の招待のデシジョンテーブル）。
// 判定の順番: 取り消し済み 404 → 期限切れ 410 → すでにグループ 409 → 満員 409。左の順に最初に当たったもの
const NOW = new Date('2026-11-01T03:00:00.000Z');
const CREATED = NOW.getTime() - 3 * 24 * 60 * 60 * 1000; // 3日前に作った
const DAY = 24 * 60 * 60 * 1000;

const base: InvitationFacts = {
  revoked: false,
  expiresAt: new Date(CREATED + 7 * DAY),
  memberCount: 3,
  alreadyInGroup: false,
};

describe('judgeInvitation（参加の判定）', () => {
  describe('デシジョンテーブル（条件が1つだけ当たる）', () => {
    it.each<[string, Partial<InvitationFacts>, ReturnType<typeof judgeInvitation>]>([
      ['ケース1: どれにも当たらない → 参加できる', {}, 'OK'],
      ['ケース2: 期限切れ → 410', { expiresAt: new Date(NOW.getTime() - 1) }, 'EXPIRED'],
      ['ケース3: 取り消し済み → 404', { revoked: true }, 'REVOKED'],
      ['ケース4: 満員（5人）→ 409 GROUP_FULL', { memberCount: 5 }, 'GROUP_FULL'],
      ['ケース5: すでにグループにいる → 409 ALREADY_IN_GROUP', { alreadyInGroup: true }, 'ALREADY_IN_GROUP'],
    ])('%s', (_label, facts, expected) => {
      expect(judgeInvitation({ ...base, ...facts }, NOW)).toBe(expected);
    });
  });

  // 境界値: 人数の上限は5人（4人なら入れる、5人なら入れない）
  it.each([
    [4, 'OK'],
    [5, 'GROUP_FULL'],
  ] as const)('今 %i 人なら %s（T-GRP-02・03）', (memberCount, expected) => {
    expect(judgeInvitation({ ...base, memberCount }, NOW)).toBe(expected);
  });

  // 期限の境目（T-INV-01〜03）。expires_at 以後は期限切れ。ちょうどの瞬間は無効（design.md 7章）
  describe('期限の境目', () => {
    const expiresAt = new Date(CREATED + 7 * DAY);
    it.each([
      ['T-INV-01 作成から6日23時間59分59秒', expiresAt.getTime() - 1000, 'OK'],
      ['T-INV-02 作成からちょうど7日', expiresAt.getTime(), 'EXPIRED'],
      ['T-INV-03 作成から7日と1秒', expiresAt.getTime() + 1000, 'EXPIRED'],
    ] as const)('%s', (_label, at, expected) => {
      expect(judgeInvitation({ ...base, expiresAt }, new Date(at))).toBe(expected);
    });
  });

  // 条件が重なったとき（ケース6〜）。順番の表どおりに、先のものが勝つ
  describe('条件が重なったとき', () => {
    it.each<[string, Partial<InvitationFacts>, ReturnType<typeof judgeInvitation>]>([
      ['取り消し済みかつ期限切れ → 404（取り消しが先）', { revoked: true, expiresAt: new Date(NOW.getTime() - 1) }, 'REVOKED'],
      ['T-INV-08 期限切れかつ満員 → 410（期限切れが満員より先）', { expiresAt: new Date(NOW.getTime() - 1), memberCount: 5 }, 'EXPIRED'],
      ['T-INV-09 満員かつすでにグループ → ALREADY_IN_GROUP（満員より先）', { memberCount: 5, alreadyInGroup: true }, 'ALREADY_IN_GROUP'],
      ['期限切れかつすでにグループ → 410', { expiresAt: new Date(NOW.getTime() - 1), alreadyInGroup: true }, 'EXPIRED'],
    ])('%s', (_label, facts, expected) => {
      expect(judgeInvitation({ ...base, ...facts }, NOW)).toBe(expected);
    });
  });
});
