import { ApiProperty } from '@nestjs/swagger';
import type { GhostResult } from '../common/ghost.js';
import { RECORD_KINDS, type RecordKind } from '../db/schema.js';
import { CREATABLE_KINDS, type CreatableKind } from './record-input.js';

export class CreateRecordRequest {
  @ApiProperty({ format: 'uuid', description: '端末で作る ID。同じ ID を送り直しても、記録は1件のまま（冪等）' })
  id!: string;

  @ApiProperty({ enum: CREATABLE_KINDS, description: '筋トレ（workout）か休み（rest）。ラン（run）は後の PR で足す' })
  kind!: CreatableKind;

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
