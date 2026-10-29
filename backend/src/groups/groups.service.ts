import { createHash, randomBytes } from 'node:crypto';
import { BadRequestException, ConflictException, GoneException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { and, asc, count, eq, sql } from 'drizzle-orm';
import { errorCode } from '../common/error-code.js';
import { DB, type Db } from '../db/db.module.js';
import { groupMembers, groups, invitations, users } from '../db/schema.js';
import { GROUP_MEMBER_MAX, judgeInvitation, type InvitationVerdict } from './invitation-judge.js';

const GROUP_NAME_MAX = 20;
// 招待リンクの有効期限は作ってから7日（docs/design.md 7章）
const INVITATION_DAYS = 7;
// 24バイト＝192ビットの乱数（128ビット以上。docs/design.md 6章）。URL に載せられる文字（base64url）にする
const TOKEN_BYTES = 24;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PG_UNIQUE_VIOLATION = '23505';
// 招待リンクの値の形（base64url）。形が違うものは DB を引かずに「見つからない」にする
const TOKEN = /^[A-Za-z0-9_-]{16,128}$/;

// トランザクションの中（tx）と外（db）のどちらからでも読めるように、select だけを求める
type Reader = Pick<Db, 'select'>;

export const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');

const notFound = (code: string, message: string) => new NotFoundException({ code, message, details: null });

@Injectable()
export class GroupsService {
  private readonly logger = new Logger(GroupsService.name);

  constructor(@Inject(DB) private readonly db: Db) {}

  async createGroup(userId: string, rawName: unknown): Promise<{ id: string; name: string }> {
    const name = this.validName(rawName);
    if (await this.groupIdOf(userId)) throw this.alreadyInGroup();

    try {
      // グループの行とメンバーの行は、片方だけ残らないよう1つのトランザクションで作る
      const group = await this.db.transaction(async (tx) => {
        const [created] = await tx.insert(groups).values({ name, createdBy: userId }).returning({ id: groups.id, name: groups.name });
        await tx.insert(groupMembers).values({ groupId: created.id, userId });
        return created;
      });
      this.logger.log(`グループを作成: ${group.id}`);
      return group;
    } catch (err) {
      // 同時に2回送られたとき、事前の確認をすり抜けても group_members.user_id の UNIQUE が止める
      if (errorCode(err) === PG_UNIQUE_VIOLATION) throw this.alreadyInGroup();
      throw err;
    }
  }

  async getCurrent(userId: string) {
    const groupId = await this.groupIdOf(userId);
    if (!groupId) throw this.noGroup();

    const [group] = await this.db.select({ id: groups.id, name: groups.name }).from(groups).where(eq(groups.id, groupId));
    // メールアドレスは仲間に見せない（名前とキャラの設定だけ）
    const members = await this.db
      .select({ id: users.id, name: users.name, avatar: users.avatar })
      .from(groupMembers)
      .innerJoin(users, eq(users.id, groupMembers.userId))
      .where(eq(groupMembers.groupId, groupId))
      .orderBy(asc(groupMembers.joinedAt), asc(users.id));
    return { ...group, members };
  }

  async createInvitation(userId: string): Promise<{ id: string; token: string; expiresAt: Date }> {
    const groupId = await this.groupIdOf(userId);
    if (!groupId) throw this.noGroup();

    // 値はこの応答の1回だけ返し、DB にはハッシュだけを保存する
    const token = randomBytes(TOKEN_BYTES).toString('base64url');
    const expiresAt = new Date(Date.now() + INVITATION_DAYS * 24 * 60 * 60 * 1000);
    const [created] = await this.db
      .insert(invitations)
      .values({ groupId, tokenHash: hashToken(token), expiresAt, createdBy: userId })
      .returning({ id: invitations.id });
    this.logger.log(`招待リンクを作成: ${created.id}`);
    return { id: created.id, token, expiresAt };
  }

  // 取り消しは行を消さず revoked_at に時刻を入れる。2回目以降は最初の時刻を残す（冪等）
  async revokeInvitation(userId: string, id: string): Promise<void> {
    const groupId = await this.groupIdOf(userId);
    if (!groupId) throw this.noGroup();
    // UUID でない文字列を DB に渡すとエラー（500）になるので、先に弾く。存在を教えない 404
    if (!UUID.test(id)) throw this.noInvitation();

    const updated = await this.db
      .update(invitations)
      .set({ revokedAt: sql`coalesce(${invitations.revokedAt}, now())` })
      .where(and(eq(invitations.id, id), eq(invitations.groupId, groupId)))
      .returning({ id: invitations.id });
    if (updated.length === 0) throw this.noInvitation();
    this.logger.log(`招待リンクを取り消し: ${id}`);
  }

  // 招待の中身（ログイン不要。docs/design.md 2章）。返すのはグループ名と今の人数だけ（メンバーの名前・記録は返さない）
  async previewInvitation(token: string): Promise<{ groupName: string; memberCount: number; memberMax: number }> {
    const invitation = await this.findInvitation(this.db, token);
    if (!invitation) throw this.noInvitation();
    const memberCount = await this.memberCount(this.db, invitation.groupId);
    // 取り消し済み・期限切れの判定は、参加と同じ関数の順番で行う（満員でも中身は見せる。画面が「満員」と出す）
    const verdict = judgeInvitation(
      { revoked: invitation.revokedAt !== null, expiresAt: invitation.expiresAt, memberCount: 0, alreadyInGroup: false },
      new Date(),
    );
    if (verdict !== 'OK') throw this.rejected(verdict);
    const [group] = await this.db.select({ name: groups.name }).from(groups).where(eq(groups.id, invitation.groupId));
    return { groupName: group.name, memberCount, memberMax: GROUP_MEMBER_MAX };
  }

  // 参加する。人数を数える前にグループの行を FOR UPDATE でロックする（docs/database-design.md）。
  // ロックしないと、READ COMMITTED では2人が同時に「4人」と数え、両方が追加して6人になる。
  // トランザクションの中では tx だけを使う（接続は1本なので、中で this.db を使うと自分の接続の空きを待って止まる）
  async acceptInvitation(userId: string, token: string): Promise<{ id: string; name: string }> {
    try {
      const group = await this.db.transaction(async (tx) => {
        const invitation = await this.findInvitation(tx, token);
        if (!invitation) throw this.noInvitation();
        const [locked] = await tx
          .select({ id: groups.id, name: groups.name })
          .from(groups)
          .where(eq(groups.id, invitation.groupId))
          .for('update');
        const memberCount = await this.memberCount(tx, locked.id);
        const [mine] = await tx.select({ groupId: groupMembers.groupId }).from(groupMembers).where(eq(groupMembers.userId, userId));
        const verdict = judgeInvitation(
          { revoked: invitation.revokedAt !== null, expiresAt: invitation.expiresAt, memberCount, alreadyInGroup: mine !== undefined },
          new Date(),
        );
        if (verdict !== 'OK') throw this.rejected(verdict);
        await tx.insert(groupMembers).values({ groupId: locked.id, userId });
        return locked;
      });
      this.logger.log(`グループに参加: ${group.id}`);
      return group;
    } catch (err) {
      // 同じ人が同時に2つの招待で参加したとき、group_members.user_id の UNIQUE が止める
      if (errorCode(err) === PG_UNIQUE_VIOLATION) throw this.alreadyInGroup();
      throw err;
    }
  }

  // グループを出る。グループの行は消さない（最後の1人が出ても空のまま残す。testing-design.md T-GRP-07）
  async leaveGroup(userId: string): Promise<void> {
    const removed = await this.db
      .delete(groupMembers)
      .where(eq(groupMembers.userId, userId))
      .returning({ groupId: groupMembers.groupId });
    if (removed.length === 0) throw this.noGroup();
    this.logger.log(`グループを出た: ${removed[0].groupId}`);
  }

  private async findInvitation(reader: Reader, token: string) {
    if (!TOKEN.test(token)) return undefined;
    const [row] = await reader
      .select({ groupId: invitations.groupId, expiresAt: invitations.expiresAt, revokedAt: invitations.revokedAt })
      .from(invitations)
      .where(eq(invitations.tokenHash, hashToken(token)));
    return row;
  }

  private async memberCount(reader: Reader, groupId: string): Promise<number> {
    const [row] = await reader.select({ n: count() }).from(groupMembers).where(eq(groupMembers.groupId, groupId));
    return row.n;
  }

  private rejected(verdict: Exclude<InvitationVerdict, 'OK'>) {
    switch (verdict) {
      case 'REVOKED':
        return this.noInvitation();
      case 'EXPIRED':
        return new GoneException({ code: 'INVITATION_EXPIRED', message: '招待リンクの期限が切れています。新しいリンクをもらってください', details: null });
      case 'ALREADY_IN_GROUP':
        return this.alreadyInGroup();
      case 'GROUP_FULL':
        return new ConflictException({ code: 'GROUP_FULL', message: 'このグループは満員です', details: null });
    }
  }

  private async groupIdOf(userId: string): Promise<string | undefined> {
    const [row] = await this.db.select({ groupId: groupMembers.groupId }).from(groupMembers).where(eq(groupMembers.userId, userId));
    return row?.groupId;
  }

  // 1〜20字（前後の空白は取り除く）。文字数は見た目の1文字を1と数える
  private validName(raw: unknown): string {
    const name = typeof raw === 'string' ? raw.trim() : '';
    const length = Array.from(name).length;
    if (length < 1 || length > GROUP_NAME_MAX) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: '入力が正しくありません',
        details: [`name: 1〜${GROUP_NAME_MAX}字で入力してください`],
      });
    }
    return name;
  }

  private alreadyInGroup() {
    return new ConflictException({ code: 'ALREADY_IN_GROUP', message: 'すでにグループに入っています', details: null });
  }

  private noGroup() {
    return notFound('GROUP_NOT_FOUND', 'グループに入っていません');
  }

  private noInvitation() {
    return notFound('INVITATION_NOT_FOUND', '招待が見つかりません');
  }
}
