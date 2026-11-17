import { Body, Controller, Delete, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiBadRequestResponse, ApiConflictResponse, ApiCreatedResponse, ApiNoContentResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { ErrorResponse } from '../common/error-response.js';
import { CreateRoutineRequest, RoutineListResponse, RoutineResponse } from './routines.response.js';
import { RoutinesService } from './routines.service.js';

// ルーティン（F3）。ログイン必須（共通のガードが既定で守る）。自分のものだけ
@ApiTags('routines')
@Controller('routines')
export class RoutinesController {
  constructor(private readonly routines: RoutinesService) {}

  @Get()
  @ApiOperation({ operationId: 'listRoutines', summary: '自分のルーティンの一覧（保存した順）と上限' })
  @ApiOkResponse({ type: RoutineListResponse })
  list(@Session() session: UserSession): Promise<RoutineListResponse> {
    return this.routines.list(session.user.id);
  }

  @Post()
  @ApiOperation({ operationId: 'createRoutine', summary: '自分の筋トレの記録1件から、種目と回数・重さを写してルーティンを保存する' })
  @ApiCreatedResponse({ type: RoutineResponse })
  @ApiBadRequestResponse({ type: ErrorResponse, description: '名前が 1〜20字でない・recordId が UUID でない（VALIDATION_ERROR）' })
  @ApiNotFoundResponse({ type: ErrorResponse, description: '記録が無い・他の人の記録（RECORD_NOT_FOUND。存在を教えない）' })
  @ApiConflictResponse({ type: ErrorResponse, description: '筋トレでない（RECORD_KIND_MISMATCH）・セットが無い（ROUTINE_EMPTY）・もう5つある（ROUTINE_LIMIT）・同じ名前がある（ROUTINE_NAME_TAKEN）' })
  create(@Session() session: UserSession, @Body() body: CreateRoutineRequest): Promise<RoutineResponse> {
    return this.routines.create(session.user.id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ operationId: 'deleteRoutine', summary: '自分のルーティンを消す' })
  @ApiNoContentResponse({ description: '消した' })
  @ApiNotFoundResponse({ type: ErrorResponse, description: '無い・他の人のもの・もう消した（ROUTINE_NOT_FOUND。存在を教えない）' })
  async remove(@Session() session: UserSession, @Param('id') id: string): Promise<void> {
    await this.routines.remove(session.user.id, id);
  }
}
