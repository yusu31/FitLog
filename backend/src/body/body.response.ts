import { ApiProperty } from '@nestjs/swagger';
import { ACTIVE_TIMES, BIO_MAX, BODY_KINDS } from '../db/schema.js';

export class WeightPointResponse {
  @ApiProperty({ example: '2026-11-18', description: '測った日（日本時間の日付）' })
  date!: string;

  @ApiProperty({ example: 70.2 })
  kg!: number;

  @ApiProperty({ type: Number, example: 70.4, nullable: true, description: 'その日を含む7日間の平均（kg）' })
  avg7!: number | null;
}

export class LatestWeightResponse {
  @ApiProperty({ example: '2026-11-18' })
  date!: string;

  @ApiProperty({ example: 70.2 })
  kg!: number;
}

export class BodyResponse {
  @ApiProperty({ type: Number, example: 170, nullable: true, description: '身長（cm）。本人だけが見える' })
  heightCm!: number | null;

  @ApiProperty({ type: LatestWeightResponse, nullable: true, description: '最新の体重' })
  latest!: LatestWeightResponse | null;

  @ApiProperty({ type: Number, example: 24.2, nullable: true, description: '最新の体重と身長から出した BMI（小数1桁）。数字だけで、判定の言葉は返さない。どちらかが無ければ null' })
  bmi!: number | null;

  @ApiProperty({ type: Number, example: 70.4, nullable: true, description: '最新の測定日を含む7日間の平均（kg）' })
  avg7!: number | null;

  @ApiProperty({ type: Number, example: -0.5, nullable: true, description: '1つ前の測定からの増減（kg。減ったら負）。測定が2件未満なら null' })
  deltaFromPrevious!: number | null;

  @ApiProperty({ type: [WeightPointResponse], description: '直近120件（古い順）' })
  weights!: WeightPointResponse[];
}

export class HeightRequest {
  @ApiProperty({ type: Number, example: 170, nullable: true, description: '100〜250 の 0.1 刻み。null で消す' })
  heightCm!: number | null;
}

export class WeightRequest {
  @ApiProperty({ example: 70.2, description: '20〜300 の 0.1 刻み' })
  kg!: number;
}

export class OneRepMaxItem {
  @ApiProperty({ format: 'uuid' })
  exerciseId!: string;

  @ApiProperty({ example: 'スクワット' })
  name!: string;

  @ApiProperty({ example: 80, description: '推定1RM（kg）。重量×(1+回数/30)。1回はそのままの重さ' })
  kg!: number;

  @ApiProperty({ example: 60, description: 'その推定の元になったセットの重量（kg）' })
  weightKg!: number;

  @ApiProperty({ example: 10, description: 'その推定の元になったセットの回数' })
  reps!: number;

  @ApiProperty({ example: false, description: '回数が12回を超えると外れやすい。true のときは「目安」と表示する' })
  approximate!: boolean;

  @ApiProperty({ example: '2026-11-18', description: 'その推定の元になったセットの記録の日' })
  date!: string;
}

export class OneRepMaxResponse {
  @ApiProperty({ type: [OneRepMaxItem], description: '推定1RM が高い順' })
  items!: OneRepMaxItem[];
}

export const CALORIE_REASONS = ['NO_WEIGHT', 'NO_DURATION', 'TOO_SLOW', 'REST'] as const;

export class CaloriesResponse {
  @ApiProperty({ format: 'uuid' })
  recordId!: string;

  @ApiProperty({ type: Number, example: 586, nullable: true, description: '推定消費カロリー（kcal）。メッツ×時間(h)×体重(kg)×1.05。出せないとき null' })
  kcal!: number | null;

  @ApiProperty({ type: Number, example: 9.3, nullable: true, description: '使ったメッツ（出典: 身体活動のメッツ表 改訂第2版（2024））' })
  mets!: number | null;

  @ApiProperty({ type: Number, example: 3600, nullable: true, description: '計算に使った時間（秒）。ランは記録の時間、筋トレは最初のセット〜最後のセット' })
  durationSec!: number | null;

  @ApiProperty({ type: Number, example: 60, nullable: true, description: '計算に使った体重（kg）。記録の日以前でいちばん新しい測定' })
  weightKg!: number | null;

  @ApiProperty({ enum: CALORIE_REASONS, nullable: true, description: '出せない理由。NO_WEIGHT=体重が無い・NO_DURATION=時間が測れない・TOO_SLOW=走る速さに届かない・REST=休み' })
  reason!: (typeof CALORIE_REASONS)[number] | null;
}

export class ProfileResponse {
  @ApiProperty()
  userId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ type: String, example: '朝ランしてます', nullable: true, description: `${BIO_MAX}字まで` })
  bio!: string | null;

  @ApiProperty({ enum: BODY_KINDS, nullable: true, description: 'よくやる運動' })
  favoriteKind!: (typeof BODY_KINDS)[number] | null;

  @ApiProperty({ enum: ACTIVE_TIMES, nullable: true, description: '動きやすい時間帯' })
  activeTime!: (typeof ACTIVE_TIMES)[number] | null;
}

export class ProfileRequest {
  @ApiProperty({ type: String, required: false, nullable: true, description: `前後の空白を除いて 1〜${BIO_MAX}字。空・省略は空にする` })
  bio?: string | null;

  @ApiProperty({ required: false, nullable: true, enum: BODY_KINDS })
  favoriteKind?: (typeof BODY_KINDS)[number] | null;

  @ApiProperty({ required: false, nullable: true, enum: ACTIVE_TIMES })
  activeTime?: (typeof ACTIVE_TIMES)[number] | null;
}
