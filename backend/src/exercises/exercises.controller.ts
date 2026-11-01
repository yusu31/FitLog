import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBadRequestResponse, ApiConflictResponse, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { ErrorResponse } from '../common/error-response.js';
import { CreateExerciseRequest, ExerciseResponse } from './exercises.response.js';
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

  @Post()
  @ApiOperation({ operationId: 'createExercise', summary: '自分用の種目を追加する' })
  @ApiCreatedResponse({ type: ExerciseResponse })
  @ApiBadRequestResponse({ type: ErrorResponse, description: '名前が1〜30字でない・部位が一覧に無い（VALIDATION_ERROR）' })
  @ApiConflictResponse({ type: ErrorResponse, description: '同じ名前（大文字小文字は区別しない）がすでにある。一覧の種目と同じ名前も同じ（EXERCISE_ALREADY_EXISTS）' })
  create(@Session() session: UserSession, @Body() body: CreateExerciseRequest) {
    return this.exercises.add(session.user.id, body);
  }
}
