import { Body, Controller, Param, Post, Res } from '@nestjs/common';
import { ApiBadRequestResponse, ApiConflictResponse, ApiCreatedResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import type { Response } from 'express';
import { ErrorResponse } from '../common/error-response.js';
import { CreateRecordRequest, CreateSetRequest, RecordResponse, SetResponse } from './records.response.js';
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

  @Post(':id/sets')
  @ApiOperation({ operationId: 'addSet', summary: '筋トレの記録にセットを足す。冪等' })
  @ApiCreatedResponse({ type: SetResponse, description: '新しく作った' })
  @ApiOkResponse({ type: SetResponse, description: 'すでにある（同じ id の再送）。1回目の内容を返す' })
  @ApiBadRequestResponse({ type: ErrorResponse, description: '重量が 0〜500 の 0.5 刻みでない・回数が 1〜999 の整数でない・id が UUID でない など（VALIDATION_ERROR）' })
  @ApiNotFoundResponse({ type: ErrorResponse, description: '記録が無い・他の人の記録（RECORD_NOT_FOUND）、種目が無い・他の人が追加した種目（EXERCISE_NOT_FOUND）、他の人のセットと同じ id（SET_NOT_FOUND）。存在を教えない' })
  @ApiConflictResponse({ type: ErrorResponse, description: '筋トレでない記録（RECORD_KIND_MISMATCH）・同じセット番号を別の id で二重登録（SET_NUMBER_TAKEN）' })
  async addSet(
    @Session() session: UserSession,
    @Param('id') recordId: string,
    @Body() body: CreateSetRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SetResponse> {
    const { created, set } = await this.records.addSet(session.user.id, recordId, body);
    if (!created) res.status(200);
    return set;
  }
}
