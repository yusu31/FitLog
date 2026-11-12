import { Controller, Get, Query } from '@nestjs/common';
import { ApiBadRequestResponse, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { ErrorResponse } from '../common/error-response.js';
import { HeatmapResponse } from './records.response.js';
import { RecordsService } from './records.service.js';

// 筋肉ヒートマップ（F-12。docs/design.md 4章）。ログイン必須（共通のガードが既定で守る）
@ApiTags('records')
@Controller('me/heatmap')
export class HeatmapController {
  constructor(private readonly records: RecordsService) {}

  @Get()
  @ApiOperation({ operationId: 'getHeatmap', summary: 'その日を含む週（月曜〜日曜）の、自分のセット数を部位ごとに返す' })
  @ApiQuery({ name: 'weekStart', required: true, example: '2026-10-26', description: '日本時間の日付（YYYY-MM-DD）。月曜でなくても、その日を含む週に直す' })
  @ApiOkResponse({ type: HeatmapResponse })
  @ApiBadRequestResponse({ type: ErrorResponse, description: 'weekStart が実在する YYYY-MM-DD でない・無い（VALIDATION_ERROR）' })
  heatmap(@Session() session: UserSession, @Query('weekStart') weekStart?: string) {
    return this.records.heatmap(session.user.id, weekStart);
  }
}
