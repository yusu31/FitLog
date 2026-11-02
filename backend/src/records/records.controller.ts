import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query, Res } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import type { Response } from 'express';
import { ErrorResponse } from '../common/error-response.js';
import { RECORD_KINDS } from '../db/schema.js';
import { CreateRecordRequest, CreateSetRequest, RecordDetailResponse, RecordListResponse, RecordResponse, SetResponse } from './records.response.js';
import { RecordsService } from './records.service.js';

// 記録（F-03・F-08。docs/design.md 4章）。すべてログイン必須（共通のガードが既定で守る）
@ApiTags('records')
@Controller('records')
export class RecordsController {
  constructor(private readonly records: RecordsService) {}

  @Post()
  @ApiOperation({ operationId: 'createRecord', summary: '記録（筋トレ・ラン・休み）を作る。冪等' })
  @ApiCreatedResponse({ type: RecordResponse, description: '新しく作った' })
  @ApiOkResponse({ type: RecordResponse, description: 'すでにある（同じ id の再送、または同じ日の休み）。1回目の内容を返す' })
  @ApiBadRequestResponse({ type: ErrorResponse, description: 'id が UUID でない・kind が workout/run/rest でない・recordedAt が日時でない／未来すぎる・ランの距離（100〜200000m）か時間（60〜86400秒）が範囲外／run の付け忘れ・付けすぎ（VALIDATION_ERROR）' })
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

  @Get()
  @ApiOperation({ operationId: 'listRecords', summary: '自分の記録の一覧（新しい順）。筋トレは種目ごとのセットを含む' })
  @ApiQuery({ name: 'limit', required: false, example: 20, description: '1ページの件数。1〜100。既定 20' })
  @ApiQuery({ name: 'cursor', required: false, description: '前の応答の nextCursor をそのまま渡す（続きを読む）' })
  @ApiQuery({ name: 'kind', required: false, enum: RECORD_KINDS, description: '種類で絞る' })
  @ApiOkResponse({ type: RecordListResponse })
  @ApiBadRequestResponse({ type: ErrorResponse, description: 'limit が 1〜100 の整数でない・kind が workout/run/rest でない・cursor が壊れている（VALIDATION_ERROR）' })
  list(@Session() session: UserSession, @Query('limit') limit?: string, @Query('cursor') cursor?: string, @Query('kind') kind?: string) {
    return this.records.list(session.user.id, { limit, cursor, kind });
  }

  @Get(':id')
  @ApiOperation({ operationId: 'getRecord', summary: '記録の詳細（セット・ラン）。自分か同じグループの人の記録だけ' })
  @ApiOkResponse({ type: RecordDetailResponse })
  @ApiNotFoundResponse({ type: ErrorResponse, description: '無い・別のグループの人の記録・グループに入っていない人から見た他人の記録（RECORD_NOT_FOUND。存在を教えない）' })
  detail(@Session() session: UserSession, @Param('id') id: string) {
    return this.records.detail(session.user.id, id);
  }

  @Delete(':id/sets/:setId')
  @HttpCode(204)
  @ApiOperation({ operationId: 'deleteSet', summary: 'セットを取り消す。自分のだけ' })
  @ApiNoContentResponse({ description: '消した' })
  @ApiNotFoundResponse({ type: ErrorResponse, description: '記録が無い・他の人の記録（RECORD_NOT_FOUND）、その記録にセットが無い・もう消した（SET_NOT_FOUND）。存在を教えない' })
  async deleteSet(@Session() session: UserSession, @Param('id') id: string, @Param('setId') setId: string): Promise<void> {
    await this.records.deleteSet(session.user.id, id, setId);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ operationId: 'deleteRecord', summary: '記録を取り消す。自分のだけ。セット・ランの詳細も一緒に消える' })
  @ApiNoContentResponse({ description: '消した' })
  @ApiNotFoundResponse({ type: ErrorResponse, description: '無い・他の人の記録・もう消した（RECORD_NOT_FOUND）。存在を教えない' })
  async deleteRecord(@Session() session: UserSession, @Param('id') id: string): Promise<void> {
    await this.records.deleteRecord(session.user.id, id);
  }
}
