import { Controller, Get, Query } from '@nestjs/common';
import { ApiBadRequestResponse, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { ErrorResponse } from '../common/error-response.js';
import { StatsResponse } from './records.response.js';
import { RecordsService } from './records.service.js';

// 記録をくわしく（F-22・F-26・F-27・F-29。docs/design.md 4章）。ログイン必須（共通のガードが既定で守る）
@ApiTags('records')
@Controller('me/stats')
export class StatsController {
  constructor(private readonly records: RecordsService) {}

  @Get()
  @ApiOperation({ operationId: 'getStats', summary: '1年分のマス・今月の数字・直近12週・スタンプを、自分の記録から返す' })
  @ApiQuery({ name: 'date', required: true, example: '2026-11-12', description: '今日の日付（日本時間。YYYY-MM-DD）' })
  @ApiOkResponse({ type: StatsResponse })
  @ApiBadRequestResponse({ type: ErrorResponse, description: 'date が実在する YYYY-MM-DD でない・無い（VALIDATION_ERROR）' })
  stats(@Session() session: UserSession, @Query('date') date?: string) {
    return this.records.stats(session.user.id, date);
  }
}
