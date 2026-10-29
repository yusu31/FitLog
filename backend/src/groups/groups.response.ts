import { ApiProperty } from '@nestjs/swagger';

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
}

export class MemberResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty({ example: 'たろう' })
  name!: string;

  @ApiProperty({ type: AvatarResponse, description: 'キャラの設定。メールアドレスは返さない' })
  avatar!: AvatarResponse;
}

export class GroupDetailResponse extends GroupResponse {
  @ApiProperty({ type: [MemberResponse], description: '参加した順' })
  members!: MemberResponse[];
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
