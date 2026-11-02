import { ApiProperty } from '@nestjs/swagger';
import type { GhostResult } from '../common/ghost.js';
import type { CellStatus } from '../common/week.js';
import { RECORD_KINDS, type RecordKind } from '../db/schema.js';
import { CREATABLE_KINDS, DISTANCE_M_MAX, DISTANCE_M_MIN, DURATION_S_MAX, DURATION_S_MIN, type CreatableKind } from './record-input.js';

export class RunDetail {
  @ApiProperty({ minimum: DISTANCE_M_MIN, maximum: DISTANCE_M_MAX, example: 5000, description: '距離（m）。100〜200,000（0.1〜200km）の整数' })
  distanceM!: number;

  @ApiProperty({ minimum: DURATION_S_MIN, maximum: DURATION_S_MAX, example: 1800, description: '時間（秒）。60〜86,400（1分〜24時間）の整数。ペースは画面が計算する' })
  durationS!: number;
}

export class CreateRecordRequest {
  @ApiProperty({ format: 'uuid', description: '端末で作る ID。同じ ID を送り直しても、記録は1件のまま（冪等）' })
  id!: string;

  @ApiProperty({ enum: CREATABLE_KINDS, description: '筋トレ（workout）・ラン（run）・休み（rest）' })
  kind!: CreatableKind;

  @ApiProperty({ type: RunDetail, required: false, description: 'kind が run のときだけ必須（距離と時間）。ほかの kind に付けると 400' })
  run?: RunDetail;

  @ApiProperty({ format: 'date-time', example: '2026-11-01T09:00:00+09:00', description: '運動した時刻（ISO 8601）。未来は5分先まで' })
  recordedAt!: string;
}

export class RecordResponse {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: RECORD_KINDS })
  kind!: RecordKind;

  @ApiProperty({ format: 'date-time', description: '運動した時刻（UTC）' })
  recordedAt!: string;

  @ApiProperty({ example: '2026-11-01', description: '日本時間の日付（YYYY-MM-DD）。サーバーが recordedAt から出す' })
  localDate!: string;

  @ApiProperty({ type: RunDetail, required: false, description: 'ランの記録だけ。距離と時間' })
  run?: RunDetail;
}

export class CreateSetRequest {
  @ApiProperty({ format: 'uuid', description: '端末で作る ID。同じ ID を送り直しても、セットは1件のまま（冪等）' })
  id!: string;

  @ApiProperty({ format: 'uuid', description: '種目の ID（一覧の種目か、自分で追加した種目）' })
  exerciseId!: string;

  @ApiProperty({ minimum: 1, maximum: 99, example: 1, description: 'その種目の何セット目か（1〜99）。同じ記録・同じ種目の中で一意' })
  setNo!: number;

  @ApiProperty({ minimum: 0, maximum: 500, multipleOf: 0.5, example: 40, description: '重量（kg）。0〜500 の 0.5 刻み。自重の種目は 0' })
  weightKg!: number;

  @ApiProperty({ minimum: 1, maximum: 999, example: 10, description: '回数（1〜999 の整数）' })
  reps!: number;
}

export class SetResponse {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 1 })
  setNo!: number;

  @ApiProperty({ example: 40 })
  weightKg!: number;

  @ApiProperty({ example: 10 })
  reps!: number;

  @ApiProperty({
    enum: ['up', 'same', 'down'],
    nullable: true,
    description: '前回の同じセットとの比べ結果。重量が同じなら回数、違えば重量×回数で比べる。前回が無ければ null。down は「負け」と言わない',
  })
  result!: GhostResult | null;

  @ApiProperty({ description: 'その種目で、過去最大の重量×回数を超えたら true（同じは false。初めての記録の最初のセットも false）' })
  isPersonalBest!: boolean;
}

export class WeekDay {
  @ApiProperty({ example: '2026-10-26', description: '日本時間の日付（YYYY-MM-DD）' })
  date!: string;

  @ApiProperty({ enum: ['rec', 'rest', 'none'], description: '記録した日は rec、休んだ日は rest、何もない日は none。同じ日に記録と休みがあれば rec' })
  status!: CellStatus;
}

export class WeekResponse {
  @ApiProperty({ example: '2026-10-26', description: 'その週の月曜の日付' })
  weekStart!: string;

  @ApiProperty({ type: [WeekDay], description: '月曜から日曜までの7日分（日付の昇順）' })
  days!: WeekDay[];
}

