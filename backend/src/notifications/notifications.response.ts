import { ApiProperty } from '@nestjs/swagger';
import { MemberResponse } from '../groups/groups.response.js';
import { RECORD_KINDS, type RecordKind } from '../db/schema.js';
import { STAMP_KEYS, type StampKey } from '../feed/stamps.js';

export const NOTIFICATION_KINDS = ['stamp', 'comment', 'friend_record', 'friend_joined'] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export class NotificationItem {
  @ApiProperty({ example: 'stamp:6f1c0000-0000-4000-8000-000000000000', description: '種類:元の行の id。画面の一覧の key に使う' })
  id!: string;

  @ApiProperty({ enum: NOTIFICATION_KINDS, description: 'stamp=スタンプをもらった／comment=コメントをもらった／friend_record=仲間が記録した／friend_joined=仲間が加わった' })
  kind!: NotificationKind;

  @ApiProperty({ format: 'date-time', description: 'そのできごとの時刻（UTC）' })
  at!: Date;

  @ApiProperty({ description: '最後にお知らせを開いた時刻より後なら true' })
  unread!: boolean;

  @ApiProperty({ type: MemberResponse, description: 'した人（自分以外・同じグループの人）' })
  actor!: MemberResponse;

  @ApiProperty({ type: String, format: 'uuid', nullable: true, description: '関係する記録（friend_joined は null）' })
  recordId!: string | null;

  @ApiProperty({ enum: RECORD_KINDS, nullable: true, description: '関係する記録の種類（friend_joined は null）' })
  recordKind!: RecordKind | null;

  @ApiProperty({ enum: STAMP_KEYS, nullable: true, description: 'stamp のときだけ、押されたスタンプ' })
  stampKey!: StampKey | null;
}

export class NotificationListResponse {
  @ApiProperty({ example: 3, description: '未読の数（一覧に載る範囲の中で数える。ベルの数字に使う）' })
  unreadCount!: number;

  @ApiProperty({ type: [NotificationItem], description: '新しい順。直近30日・最大30件。グループに入っていなければ空' })
  items!: NotificationItem[];
}
