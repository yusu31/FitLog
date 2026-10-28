import { ApiProperty } from '@nestjs/swagger';

// エラーの応答の共通の形（docs/design.md 5章）。画面の型もこの形から生成する。
export class ErrorResponse {
  @ApiProperty({ example: 'DB_UNAVAILABLE', description: '画面が分岐に使う、決まった識別子' })
  code!: string;

  @ApiProperty({ example: 'データベースに接続できません', description: '画面に出せる日本語の文言（内部の事情を入れない）' })
  message!: string;

  @ApiProperty({
    type: 'array',
    items: { type: 'string' },
    nullable: true,
    description: '入力エラーのとき、項目ごとの理由。それ以外は null',
  })
  details!: string[] | null;
}
