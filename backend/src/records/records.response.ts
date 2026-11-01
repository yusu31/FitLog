import { ApiProperty } from '@nestjs/swagger';
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
