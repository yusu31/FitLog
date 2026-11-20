import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, exists, gt, ne, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { PgColumn } from 'drizzle-orm/pg-core';
import { DB, type Db } from '../db/db.module.js';
import { comments, groupMembers, reactions, records, users } from '../db/schema.js';
import { ownerInMyGroup } from '../records/record-access.js';
import type { StampKey } from '../feed/stamps.js';
import type { NotificationItem, NotificationListResponse } from './notifications.response.js';

// お知らせ（D7-3）。専用の表は作らず、すでにある記録・スタンプ・コメント・グループへの参加から、その場で組み立てる。
// 見られる範囲は「同じグループの自分以外の人」だけ（record-access.ts と同じ考え方）。
// 対象は、自分がグループに入ったあとの、直近30日・最大30件。入る前の仲間の過去の記録は通知にしない
export const NOTIFICATION_LIMIT = 30;
export const NOTIFICATION_DAYS = 30;

const mine = alias(groupMembers, 'n_mine');
const theirs = alias(groupMembers, 'n_theirs');

type Actor = { actorId: string; actorName: string; actorAvatar: unknown };
const actorOf = (r: Actor): NotificationItem['actor'] => ({ id: r.actorId, name: r.actorName, avatar: r.actorAvatar as NotificationItem['actor']['avatar'] });

@Injectable()
export class NotificationsService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async list(userId: string): Promise<NotificationListResponse> {
    const [me] = await this.db
      .select({ seenAt: sql<Date>`coalesce(${users.notificationsSeenAt}, ${users.createdAt})`.mapWith(users.createdAt), joinedAt: groupMembers.joinedAt })
      .from(users)
      .leftJoin(groupMembers, eq(groupMembers.userId, users.id))
      .where(eq(users.id, userId));
    if (!me?.joinedAt) return { unreadCount: 0, items: [] };

    const windowStart = new Date(Date.now() - NOTIFICATION_DAYS * 24 * 60 * 60 * 1000);
    const since = me.joinedAt > windowStart ? me.joinedAt : windowStart;
    // その人が、いま自分と同じグループにいる
    const actorInMyGroup = (col: PgColumn) =>
      exists(this.db.select({ one: sql`1` }).from(theirs).innerJoin(mine, eq(mine.groupId, theirs.groupId)).where(and(eq(theirs.userId, col), eq(mine.userId, userId))));

    const [stamps, commentRows, friendRecords, joined] = await Promise.all([
      this.db
        .select({ id: reactions.id, at: reactions.createdAt, stampKey: reactions.stampKey, recordId: records.id, recordKind: records.kind, actorId: users.id, actorName: users.name, actorAvatar: users.avatar })
        .from(reactions)
        .innerJoin(records, eq(records.id, reactions.recordId))
        .innerJoin(users, eq(users.id, reactions.userId))
        .where(and(eq(records.userId, userId), ne(reactions.userId, userId), gt(reactions.createdAt, since), actorInMyGroup(reactions.userId)))
        .orderBy(desc(reactions.createdAt))
        .limit(NOTIFICATION_LIMIT),
      this.db
        .select({ id: comments.id, at: comments.createdAt, recordId: records.id, recordKind: records.kind, actorId: users.id, actorName: users.name, actorAvatar: users.avatar })
        .from(comments)
        .innerJoin(records, eq(records.id, comments.recordId))
        .innerJoin(users, eq(users.id, comments.userId))
        .where(and(eq(records.userId, userId), ne(comments.userId, userId), gt(comments.createdAt, since), actorInMyGroup(comments.userId)))
        .orderBy(desc(comments.createdAt))
        .limit(NOTIFICATION_LIMIT),
      this.db
        .select({ id: records.id, at: records.createdAt, recordId: records.id, recordKind: records.kind, actorId: users.id, actorName: users.name, actorAvatar: users.avatar })
        .from(records)
        .innerJoin(users, eq(users.id, records.userId))
        .where(and(ownerInMyGroup(this.db, userId), ne(records.userId, userId), gt(records.createdAt, since)))
        .orderBy(desc(records.createdAt))
        .limit(NOTIFICATION_LIMIT),
      this.db
        .select({ id: theirs.userId, at: theirs.joinedAt, actorId: users.id, actorName: users.name, actorAvatar: users.avatar })
        .from(theirs)
        .innerJoin(mine, eq(mine.groupId, theirs.groupId))
        .innerJoin(users, eq(users.id, theirs.userId))
        .where(and(eq(mine.userId, userId), ne(theirs.userId, userId), gt(theirs.joinedAt, since)))
        .orderBy(desc(theirs.joinedAt))
        .limit(NOTIFICATION_LIMIT),
    ]);

    const unread = (at: Date) => at > me.seenAt;
    const items: NotificationItem[] = [
      ...stamps.map((r) => ({ id: `stamp:${r.id}`, kind: 'stamp' as const, at: r.at, unread: unread(r.at), actor: actorOf(r), recordId: r.recordId, recordKind: r.recordKind, stampKey: r.stampKey as StampKey })),
      ...commentRows.map((r) => ({ id: `comment:${r.id}`, kind: 'comment' as const, at: r.at, unread: unread(r.at), actor: actorOf(r), recordId: r.recordId, recordKind: r.recordKind, stampKey: null })),
      ...friendRecords.map((r) => ({ id: `friend_record:${r.id}`, kind: 'friend_record' as const, at: r.at, unread: unread(r.at), actor: actorOf(r), recordId: r.recordId, recordKind: r.recordKind, stampKey: null })),
      ...joined.map((r) => ({ id: `friend_joined:${r.id}`, kind: 'friend_joined' as const, at: r.at, unread: unread(r.at), actor: actorOf(r), recordId: null, recordKind: null, stampKey: null })),
    ]
      .sort((a, b) => b.at.getTime() - a.at.getTime())
      .slice(0, NOTIFICATION_LIMIT);
    return { unreadCount: items.filter((i) => i.unread).length, items };
  }

  // お知らせを見た。基準を今にする。何度呼んでもよい。グループに入っていない人が呼んでも何も困らない
  async markSeen(userId: string): Promise<void> {
    await this.db.update(users).set({ notificationsSeenAt: sql`now()` }).where(eq(users.id, userId));
  }
}
