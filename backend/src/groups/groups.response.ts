import { ApiProperty } from '@nestjs/swagger';
import { GROUP_BACKGROUNDS, type GroupBackground } from '../db/schema.js';

export class CreateGroupRequest {
  @ApiProperty({ example: '朝ランの会', minLength: 1, maxLength: 20, description: 'グループ名（1〜20字）' })
  name!: string;
}

export class GroupResponse {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: '朝ランの会' })
  name!: string;
}

export class AvatarResponse {
  @ApiProperty({ example: 'A' })
  body!: string;

  @ApiProperty({ example: 1 })
  hair!: number;

  @ApiProperty({ example: 'brown' })
  hairColor!: string;

  @ApiProperty({ example: 'teal' })
  shirtColor!: string;

  @ApiProperty({ example: 'navy' })
  pantsColor!: string;

  @ApiProperty({ example: 'none', required: false, description: '小物。古い行には無い（無ければ none として扱う）' })
  accessory?: string;
}

export class MemberResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty({ example: 'たろう' })
  name!: string;

  @ApiProperty({ type: 'string', example: '朝ランが好きです', nullable: true, required: false, description: 'ひとこと（プロフィール）。無ければ null' })
  bio?: string | null;

  @ApiProperty({ type: AvatarResponse, description: 'キャラの設定。メールアドレスは返さない' })
  avatar!: AvatarResponse;
}

// 今日のようす（運動場のポーズに使う）。workout＝筋トレ済み・run＝ラン済み（両方ある日は workout）・rest＝休み・none＝まだ（投稿だけの日も none）
export const MEMBER_TODAY = ['workout', 'run', 'rest', 'none'] as const;
export type MemberToday = (typeof MEMBER_TODAY)[number];

export class GroupMemberResponse extends MemberResponse {
  @ApiProperty({ enum: MEMBER_TODAY, enumName: 'MemberToday', description: '今日（日本時間）のようす。運動場のポーズになる' })
  today!: MemberToday;
}

// タイムラインの上に出す出来事の1行。joined＝仲間が加わった・mission＝ミッションが直された
export const GROUP_EVENT_KINDS = ['joined', 'mission'] as const;

export class GroupEventResponse {
  @ApiProperty({ enum: GROUP_EVENT_KINDS, enumName: 'GroupEventKind' })
  kind!: (typeof GROUP_EVENT_KINDS)[number];

  @ApiProperty({ format: 'date-time' })
  at!: Date;

  @ApiProperty({ type: String, nullable: true, description: '加わった人・直した人の ID。退会していれば null' })
  actorId!: string | null;

  @ApiProperty({ type: String, nullable: true, description: '加わった人・直した人の名前。退会していれば null' })
  actorName!: string | null;
}

export class GroupDetailResponse extends GroupResponse {
  @ApiProperty({ type: String, nullable: true, example: '朝6時に走って、夜は筋トレ', description: 'ミッションの説明（100字まで）。無ければ null' })
  description!: string | null;

  @ApiProperty({ enum: GROUP_BACKGROUNDS, enumName: 'GroupBackground', description: '運動場の背景' })
  background!: GroupBackground;

  @ApiProperty({ type: [GroupMemberResponse], description: '参加した順' })
  members!: GroupMemberResponse[];

  @ApiProperty({ type: [GroupEventResponse], description: '直近14日の出来事（仲間が加わった・ミッションが直された）。新しい順・最大5件' })
  events!: GroupEventResponse[];
}

export class UpdateGroupRequest {
  @ApiProperty({ required: false, minLength: 1, maxLength: 20, description: 'ミッション名（1〜20字）。送ったものだけ直す' })
  name?: string;

  @ApiProperty({ required: false, type: String, nullable: true, maxLength: 100, description: 'ミッションの説明（100字まで）。空文字か null で消す' })
  description?: string | null;

  @ApiProperty({ required: false, enum: GROUP_BACKGROUNDS, enumName: 'GroupBackground', description: '運動場の背景' })
  background?: GroupBackground;
}

export class InvitationCreatedResponse {
  @ApiProperty({ format: 'uuid', description: '取り消すときに使う ID' })
  id!: string;

  @ApiProperty({ description: '招待リンクの値。**この応答の1回だけ**返す（DB にはハッシュだけを保存する）' })
  token!: string;

  @ApiProperty({ format: 'date-time', description: '作ってから7日' })
  expiresAt!: Date;
}

export class InvitationPreviewResponse {
  @ApiProperty({ example: '朝トレ部' })
  groupName!: string;

  @ApiProperty({ example: 3, description: '今の人数' })
  memberCount!: number;

  @ApiProperty({ example: 5, description: '人数の上限' })
  memberMax!: number;
}
