// 招待リンクで参加できるかの判定（docs/design.md 7章）。DB に触れない関数にして、判定の表と期限の境目を単体テストで確かめる。
// 順番: 取り消し済み → 期限切れ → すでにグループ → 満員。左の順に最初に当たったものを返す
export const GROUP_MEMBER_MAX = 5;

export type InvitationFacts = {
  revoked: boolean;
  expiresAt: Date;
  memberCount: number;
  alreadyInGroup: boolean;
};

export type InvitationVerdict = 'OK' | 'REVOKED' | 'EXPIRED' | 'ALREADY_IN_GROUP' | 'GROUP_FULL';

export function judgeInvitation(facts: InvitationFacts, now: Date): InvitationVerdict {
  if (facts.revoked) return 'REVOKED';
  // expires_at ちょうどの瞬間は、もう使えない
  if (now.getTime() >= facts.expiresAt.getTime()) return 'EXPIRED';
  if (facts.alreadyInGroup) return 'ALREADY_IN_GROUP';
  if (facts.memberCount >= GROUP_MEMBER_MAX) return 'GROUP_FULL';
  return 'OK';
}
