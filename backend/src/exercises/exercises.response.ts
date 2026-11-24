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

  @ApiProperty({ type: [String], nullable: true, example: ['大胸筋', '上腕三頭筋'], description: '鍛える筋肉（主に使う筋肉の名前）。一覧の種目だけ。自分で追加した種目は null' })
  muscles!: string[] | null;

  @ApiProperty({ type: Number, nullable: true, minimum: 1, maximum: 3, example: 2, description: '難しさ（1=やさしい〜3=むずかしい）。一覧の種目だけ。自分で追加した種目は null' })
  difficulty!: number | null;

  @ApiProperty({ type: [String], nullable: true, description: 'やり方の手順（2〜3行）。一覧の種目だけ。自分で追加した種目は null' })
  steps!: string[] | null;

  @ApiProperty({ type: String, nullable: true, example: 'バーを胸から押し上げる。胸の基本', description: '一言説明。一覧の種目だけ。自分で追加した種目は null' })
  cue!: string | null;
}

export class PreviousSetResponse {
  @ApiProperty({ example: 1 })
  setNo!: number;

  @ApiProperty({ example: 40 })
  weightKg!: number;

  @ApiProperty({ example: 10 })
  reps!: number;
}

export class PreviousRecordResponse {
  @ApiProperty({ format: 'date-time', description: '前回の記録の時刻（UTC）' })
  recordedAt!: string;

  @ApiProperty({ type: [PreviousSetResponse], description: '前回のセット（セット番号の順）' })
  sets!: PreviousSetResponse[];
}

export class PersonalBestResponse {
  @ApiProperty({ example: 45 })
  weightKg!: number;

  @ApiProperty({ example: 8 })
  reps!: number;

  @ApiProperty({ example: 360, description: '重量×回数' })
  volume!: number;
}

export class PreviousResponse {
  @ApiProperty({ type: PreviousRecordResponse, nullable: true, description: '同じ種目の直近の記録。無ければ null' })
  previous!: PreviousRecordResponse | null;

  @ApiProperty({ type: PersonalBestResponse, nullable: true, description: '過去最大の重量×回数のセット。無ければ null' })
  personalBest!: PersonalBestResponse | null;
}

