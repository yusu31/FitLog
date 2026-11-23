import { ApiProperty } from '@nestjs/swagger';
import { AVATAR_ACCESSORIES, AVATAR_BODIES, AVATAR_HAIR_COLORS, AVATAR_HAIRS, AVATAR_PANTS_COLORS, AVATAR_SHIRT_COLORS } from './avatar-input.js';

// 保存・取得で同じ形（PUT で送った値がそのまま返る）
export class AvatarSettings {
  @ApiProperty({ enum: AVATAR_BODIES, description: 'A=男性寄り・B=女性寄りの体つき' })
  body!: (typeof AVATAR_BODIES)[number];

  @ApiProperty({ enum: AVATAR_HAIRS, description: '髪型の番号（1 短髪・2 ナチュラル・3 流し前髪・4 ストレート・5 ツンツン）' })
  hair!: (typeof AVATAR_HAIRS)[number];

  @ApiProperty({ enum: AVATAR_HAIR_COLORS })
  hairColor!: (typeof AVATAR_HAIR_COLORS)[number];

  @ApiProperty({ enum: AVATAR_SHIRT_COLORS })
  shirtColor!: (typeof AVATAR_SHIRT_COLORS)[number];

  @ApiProperty({ enum: AVATAR_PANTS_COLORS })
  pantsColor!: (typeof AVATAR_PANTS_COLORS)[number];

  @ApiProperty({ enum: AVATAR_ACCESSORIES, required: false, description: '小物。省くと none（なし）' })
  accessory?: (typeof AVATAR_ACCESSORIES)[number];
}
