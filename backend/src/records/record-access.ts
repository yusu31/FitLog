import { and, eq, exists, inArray, ne, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { Db } from '../db/db.module.js';
import { isUuid } from '../common/uuid.js';
import { groupMembers, records, users, type RecordKind } from '../db/schema.js';

// 人の見える範囲を決める「共通の関数」の置き場（docs/design.md 6章「他グループのデータが見える」の守り）。
// 記録を取るクエリ（詳細・足跡・スタンプ・コメント）は、必ずここの条件を where に付ける。個別の API に条件を散らさない。

const mine = alias(groupMembers, 'mine');
const theirs = alias(groupMembers, 'theirs');

// 記録の持ち主が、userId と同じグループにいる、という条件（自分の記録かどうかは別に判定する）。
// group_members.user_id は UNIQUE（1人1グループ）なので、同じ group_id に載っている行を引けば仲間が分かる。
// グループにいない人は mine の行が無いので、何も当たらない（足跡は空になる）。自分もグループにいれば、自分の記録も当たる
export const ownerInMyGroup = (db: Db, userId: string) =>
  exists(
    db
      .select({ one: sql`1` })
      .from(theirs)
      .innerJoin(mine, eq(mine.groupId, theirs.groupId))
      .where(and(eq(theirs.userId, records.userId), eq(mine.userId, userId))),
  );

// candidateIds のうち、userId と同じグループにいる「自分以外の人」を（id → 名前）で返す。
// 仲間のゴースト（F-16）とメニューのコピー（F-24）が、他人のデータを読む前の確認に使う。グループ外・自分自身・無い id は入らない
export async function findGroupMates(db: Db, userId: string, candidateIds: string[]): Promise<Map<string, string>> {
  if (candidateIds.length === 0) return new Map();
  const rows = await db
    .select({ id: users.id, name: users.name })
    .from(theirs)
    .innerJoin(mine, eq(mine.groupId, theirs.groupId))
    .innerJoin(users, eq(users.id, theirs.userId))
    .where(and(eq(mine.userId, userId), ne(theirs.userId, userId), inArray(theirs.userId, candidateIds)));
  return new Map(rows.map((r) => [r.id, r.name]));
}

// userId が見られる記録: 自分の記録か、同じグループの人の記録（記録の詳細・スタンプ・コメントが使う）。
// 別のグループの人の記録・グループに入っていない人から見た他人の記録は当たらない（呼び出し側が 404 にする）
export const visibleToMe = (db: Db, userId: string) => or(eq(records.userId, userId), ownerInMyGroup(db, userId));

// 見られる記録を1件引く（スタンプ・コメントを付ける前の確認）。無い・別のグループの人の・グループに入っていない人から見た他人のものは、どれも undefined（呼び出し側が同じ 404 にする）。
// id が UUID の形でないときは DB を引かない（uuid 列に渡すとエラー 500 になるため）
export async function findVisibleRecord(db: Db, userId: string, recordId: string): Promise<{ id: string; kind: RecordKind } | undefined> {
  if (!isUuid(recordId)) return undefined;
  const [row] = await db
    .select({ id: records.id, kind: records.kind })
    .from(records)
    .where(and(eq(records.id, recordId.toLowerCase()), visibleToMe(db, userId)));
  return row;
}
