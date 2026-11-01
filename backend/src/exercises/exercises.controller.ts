import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBadRequestResponse, ApiConflictResponse, ApiCreatedResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { ErrorResponse } from '../common/error-response.js';
import { CreateExerciseRequest, ExerciseResponse, PreviousResponse } from './exercises.response.js';
import { ExercisesService } from './exercises.service.js';

// 種目（F-03。docs/design.md 4章）。すべてログイン必須（共通のガードが既定で守る）
@ApiTags('exercises')
@Controller('exercises')
export class ExercisesController {
  constructor(private readonly exercises: ExercisesService) {}

  @Get()
  @ApiOperation({ operationId: 'listExercises', summary: '一覧の種目と、自分が追加した種目を返す（部位の順）' })
  @ApiOkResponse({ type: [ExerciseResponse] })
  list(@Session() session: UserSession) {
    return this.exercises.list(session.user.id);
  }

  @Get(':id/previous')
  @ApiOperation({ operationId: 'getPrevious', summary: '前回（同じ種目の直近の記録）と自己ベストを返す（ゴースト）' })
  @ApiQuery({ name: 'before', required: false, description: 'この時刻（ISO 8601）より前の記録だけを見る。記録中の自分の記録を前回にしないために、今の記録の時刻を渡す' })
  @ApiOkResponse({ type: PreviousResponse, description: '前回がなければ previous が null' })
  @ApiBadRequestResponse({ type: ErrorResponse, description: 'before が ISO 8601 の日時でない（VALIDATION_ERROR）' })
  @ApiNotFoundResponse({ type: ErrorResponse, description: '種目が無い・他の人が追加した種目（EXERCISE_NOT_FOUND。存在を教えない）' })
  previous(@Session() session: UserSession, @Param('id') id: string, @Query('before') before?: string) {
    return this.exercises.previous(session.user.id, id, before);
  }

  @Post()
  @ApiOperation({ operationId: 'createExercise', summary: '自分用の種目を追加する' })
  @ApiCreatedResponse({ type: ExerciseResponse })
  @ApiBadRequestResponse({ type: ErrorResponse, description: '名前が1〜30字でない・部位が一覧に無い（VALIDATION_ERROR）' })
  @ApiConflictResponse({ type: ErrorResponse, description: '同じ名前（大文字小文字は区別しない）がすでにある。一覧の種目と同じ名前も同じ（EXERCISE_ALREADY_EXISTS）' })
  create(@Session() session: UserSession, @Body() body: CreateExerciseRequest) {
    return this.exercises.add(session.user.id, body);
  }
}
