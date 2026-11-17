import { ApiProperty } from '@nestjs/swagger';
import { BODY_PARTS, ROUTINE_MAX, ROUTINE_NAME_MAX, type BodyPart } from '../db/schema.js';

export class RoutineSet {
  @ApiProperty({ example: 1, description: '種目の中で1から振り直した番号' })
  setNo!: number;

  @ApiProperty({ example: 40 })
  weightKg!: number;

  @ApiProperty({ example: 10 })
  reps!: number;
}

export class RoutineExercise {
  @ApiProperty({ format: 'uuid' })
  exerciseId!: string;

  @ApiProperty({ example: 'ベンチプレス' })
  name!: string;

  @ApiProperty({ enum: BODY_PARTS })
  bodyPart!: BodyPart;

  @ApiProperty({ type: [RoutineSet], description: 'セット番号の昇順' })
  sets!: RoutineSet[];
}

export class RoutineResponse {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: '脚の日', description: `1〜${ROUTINE_NAME_MAX}字` })
  name!: string;

  @ApiProperty({ type: [RoutineExercise], description: '種目の並びは、元の記録で最初にセットを足した順' })
  exercises!: RoutineExercise[];

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

export class RoutineListResponse {
  @ApiProperty({ type: [RoutineResponse], description: '古い順（保存した順）' })
  items!: RoutineResponse[];

  @ApiProperty({ example: ROUTINE_MAX, description: '1人が保存できる上限' })
  max!: number;
}

export class CreateRoutineRequest {
  @ApiProperty({ example: '脚の日', description: `前後の空白を除いて 1〜${ROUTINE_NAME_MAX}字。同じ名前（大文字小文字を区別しない）は保存できない` })
  name!: string;

  @ApiProperty({ format: 'uuid', description: '写す元の、自分の筋トレの記録（セットが1つ以上あるもの）' })
  recordId!: string;
}
