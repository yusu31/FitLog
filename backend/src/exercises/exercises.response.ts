import { ApiProperty } from '@nestjs/swagger';
import { BODY_PARTS, type BodyPart } from '../db/schema.js';
import { EXERCISE_NAME_MAX } from './exercise-input.js';

export class CreateExerciseRequest {
  @ApiProperty({ example: 'ヨガ', minLength: 1, maxLength: EXERCISE_NAME_MAX, description: '種目名（1〜30字。前後の空白は取り除く）' })
  name!: string;

  @ApiProperty({ enum: BODY_PARTS, enumName: 'BodyPart', example: 'abs', description: 'ヒートマップの部位。種目ごとに1つ' })
  bodyPart!: BodyPart;
}

export class ExerciseResponse {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'ベンチプレス' })
  name!: string;

  @ApiProperty({ enum: BODY_PARTS, enumName: 'BodyPart' })
  bodyPart!: BodyPart;

  @ApiProperty({ description: '自分で追加した種目なら true。一覧の種目は false' })
  isCustom!: boolean;

  @ApiProperty({ type: Number, nullable: true, example: 20, description: 'お試しの前回値の重量（kg）。一覧の種目だけ。自分で追加した種目は null' })
  trialWeightKg!: number | null;

  @ApiProperty({ type: Number, nullable: true, example: 10, description: 'お試しの前回値の回数。一覧の種目だけ。自分で追加した種目は null' })
  trialReps!: number | null;
}
