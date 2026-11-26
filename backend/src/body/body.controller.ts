import { Body, Controller, Delete, Get, HttpCode, Param, Put } from '@nestjs/common';
import { ApiBadRequestResponse, ApiNoContentResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { ErrorResponse } from '../common/error-response.js';
import { BodyService } from './body.service.js';
import { BodyResponse, CaloriesResponse, HeightRequest, MaxWeightsResponse, OneRepMaxResponse, ProfileRequest, ProfileResponse, WeightRequest } from './body.response.js';

// からだ（B14a）。ログイン必須（共通のガードが既定で守る）。体重・身長・推定値は本人だけ。プロフィールは同じグループの仲間まで
@ApiTags('body')
@Controller('body')
export class BodyController {
  constructor(private readonly body: BodyService) {}

  @Get()
  @ApiOperation({ operationId: 'getBody', summary: '自分の身長・体重の推移・BMI・7日平均と前回からの増減（判定の言葉は返さない）' })
  @ApiOkResponse({ type: BodyResponse })
  get(@Session() session: UserSession): Promise<BodyResponse> {
    return this.body.get(session.user.id);
  }

  @Put('height')
  @HttpCode(200)
  @ApiOperation({ operationId: 'setHeight', summary: '自分の身長（cm）を保存する。null で消す' })
  @ApiOkResponse({ description: '保存した' })
  @ApiBadRequestResponse({ type: ErrorResponse, description: '100〜250 の 0.1 刻みでない（VALIDATION_ERROR）' })
  async setHeight(@Session() session: UserSession, @Body() body: HeightRequest): Promise<void> {
    await this.body.setHeight(session.user.id, body);
  }

  @Put('weights/:date')
  @HttpCode(200)
  @ApiOperation({ operationId: 'setWeight', summary: 'その日の体重（kg）を保存する。同じ日は上書き' })
  @ApiOkResponse({ description: '保存した' })
  @ApiBadRequestResponse({ type: ErrorResponse, description: '日付が YYYY-MM-DD でない・未来・kg が 20〜300 の 0.1 刻みでない（VALIDATION_ERROR）' })
  async setWeight(@Session() session: UserSession, @Param('date') date: string, @Body() body: WeightRequest): Promise<void> {
    await this.body.setWeight(session.user.id, date, body);
  }

  @Delete('weights/:date')
  @HttpCode(204)
  @ApiOperation({ operationId: 'deleteWeight', summary: 'その日の体重を消す' })
  @ApiNoContentResponse({ description: '消した' })
  @ApiNotFoundResponse({ type: ErrorResponse, description: '無い・他の人のもの（WEIGHT_NOT_FOUND）' })
  async removeWeight(@Session() session: UserSession, @Param('date') date: string): Promise<void> {
    await this.body.removeWeight(session.user.id, date);
  }

  @Get('one-rm')
  @ApiOperation({ operationId: 'getOneRepMax', summary: '自分の種目ごとの推定1RM（Epley）。13回以上のセットが元のときは approximate' })
  @ApiOkResponse({ type: OneRepMaxResponse })
  oneRepMax(@Session() session: UserSession): Promise<OneRepMaxResponse> {
    return this.body.oneRepMax(session.user.id);
  }

  @Get('exercises/:exerciseId/max-weights')
  @ApiOperation({ operationId: 'getExerciseMaxWeights', summary: '自分の種目1つの「その日の最大重量」の推移（日付の昇順。自重だけの日は点にしない）' })
  @ApiOkResponse({ type: MaxWeightsResponse })
  @ApiNotFoundResponse({ type: ErrorResponse, description: '種目が無い・他の人の種目・UUID でない（EXERCISE_NOT_FOUND。存在を教えない）' })
  maxWeights(@Session() session: UserSession, @Param('exerciseId') exerciseId: string): Promise<MaxWeightsResponse> {
    return this.body.maxWeights(session.user.id, exerciseId);
  }

  @Get('calories/:recordId')
  @ApiOperation({ operationId: 'getCalories', summary: '自分の記録1件の推定消費カロリー（メッツ×時間×体重×1.05）。出せないときは kcal: null と理由' })
  @ApiOkResponse({ type: CaloriesResponse })
  @ApiNotFoundResponse({ type: ErrorResponse, description: '記録が無い・他の人の記録・UUID でない（RECORD_NOT_FOUND。存在を教えない）' })
  calories(@Session() session: UserSession, @Param('recordId') recordId: string): Promise<CaloriesResponse> {
    return this.body.calories(session.user.id, recordId);
  }

  @Get('profile')
  @ApiOperation({ operationId: 'getMyProfile', summary: '自分のプロフィール（ひとこと・よくやる運動・動きやすい時間帯）' })
  @ApiOkResponse({ type: ProfileResponse })
  getProfile(@Session() session: UserSession): Promise<ProfileResponse> {
    return this.body.getProfile(session.user.id);
  }

  @Put('profile')
  @HttpCode(200)
  @ApiOperation({ operationId: 'setMyProfile', summary: '自分のプロフィールを保存する（置き換え。送らなかった欄は空になる）' })
  @ApiOkResponse({ type: ProfileResponse })
  @ApiBadRequestResponse({ type: ErrorResponse, description: 'ひとこと 40字超・決まった値でない（VALIDATION_ERROR）' })
  setProfile(@Session() session: UserSession, @Body() body: ProfileRequest): Promise<ProfileResponse> {
    return this.body.setProfile(session.user.id, body);
  }

  @Get('profile/:userId')
  @ApiOperation({ operationId: 'getMateProfile', summary: '同じグループの仲間のプロフィール。体重・身長は含まない' })
  @ApiOkResponse({ type: ProfileResponse })
  @ApiNotFoundResponse({ type: ErrorResponse, description: '同じグループでない・存在しない（USER_NOT_FOUND。存在を教えない）' })
  getMateProfile(@Session() session: UserSession, @Param('userId') userId: string): Promise<ProfileResponse> {
    return this.body.getMateProfile(session.user.id, userId);
  }
}
