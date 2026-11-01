import { Body, Controller, Post, Res } from '@nestjs/common';
import { ApiBadRequestResponse, ApiCreatedResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import type { Response } from 'express';
import { ErrorResponse } from '../common/error-response.js';
import { CreateRecordRequest, RecordResponse } from './records.response.js';
import { RecordsService } from './records.service.js';

// 記録（F-03・F-08。docs/design.md 4章）。すべてログイン必須（共通のガードが既定で守る）
@ApiTags('records')
@Controller('records')
export class RecordsController {
  constructor(private readonly records: RecordsService) {}

  @Post()
  @ApiOperation({ operationId: 'createRecord', summary: '記録（筋トレ・休み）を作る。冪等' })
  @ApiCreatedResponse({ type: RecordResponse, description: '新しく作った' })
  @ApiOkResponse({ type: RecordResponse, description: 'すでにある（同じ id の再送、または同じ日の休み）。1回目の内容を返す' })
  @ApiBadRequestResponse({ type: ErrorResponse, description: 'id が UUID でない・kind が workout/rest でない・recordedAt が日時でない／未来すぎる（VALIDATION_ERROR）' })
  @ApiNotFoundResponse({ type: ErrorResponse, description: '同じ id が他の人の記録にある（RECORD_NOT_FOUND。存在を教えない）' })
  async create(@Session() session: UserSession, @Body() body: CreateRecordRequest, @Res({ passthrough: true }) res: Response): Promise<RecordResponse> {
    const { created, record } = await this.records.create(session.user.id, body);
    // 新しく作ったときだけ 201（POST の既定）。すでにあるものを返すときは 200
    if (!created) res.status(200);
    return record;
  }
}
