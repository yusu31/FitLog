import { Controller, Get, Query } from '@nestjs/common';
import { ApiBadRequestResponse, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { ErrorResponse } from '../common/error-response.js';
import { WeekResponse } from './records.response.js';
import { RecordsService } from './records.service.js';

// 今週の7マス（F-07。docs/design.md 4章）。ログイン必須（共通のガードが既定で守る）
@ApiTags('records')
@Controller('week')
export class WeekController {
  constructor(private readonly records: RecordsService) {}

  @Get()
  @ApiOperation({ operationId: 'getWeek', summary: 'その日を含む週（月曜〜日曜）の、自分の7マスを返す' })
  @ApiQuery({ name: 'date', required: true, example: '2026-10-26', description: '日本時間の日付（YYYY-MM-DD）' })
  @ApiOkResponse({ type: WeekResponse })
  @ApiBadRequestResponse({ type: ErrorResponse, description: 'date が実在する YYYY-MM-DD でない・無い（VALIDATION_ERROR）' })
  week(@Session() session: UserSession, @Query('date') date?: string) {
    return this.records.week(session.user.id, date);
  }
}
