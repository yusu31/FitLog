import { Body, Controller, Get, HttpCode, Put } from '@nestjs/common';
import { ApiBadRequestResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { ErrorResponse } from '../common/error-response.js';
import { AvatarService } from './avatar.service.js';
import { AvatarSettings } from './avatar.response.js';

// キャラの編集（F-32）。ログイン必須（共通のガードが既定で守る）。自分のキャラだけ読み書きできる（仲間のキャラは仲間の API が返す）
@ApiTags('avatar')
@Controller('avatar')
export class AvatarController {
  constructor(private readonly avatar: AvatarService) {}

  @Get()
  @ApiOperation({ operationId: 'getMyAvatar', summary: '自分のキャラの設定（体型・髪型・髪／服／ズボンの色・小物）' })
  @ApiOkResponse({ type: AvatarSettings })
  get(@Session() session: UserSession): Promise<AvatarSettings> {
    return this.avatar.get(session.user.id);
  }

  @Put()
  @HttpCode(200)
  @ApiOperation({ operationId: 'setMyAvatar', summary: '自分のキャラの設定を保存する（置き換え）' })
  @ApiOkResponse({ type: AvatarSettings })
  @ApiBadRequestResponse({ type: ErrorResponse, description: '選べない値（VALIDATION_ERROR）' })
  set(@Session() session: UserSession, @Body() body: AvatarSettings): Promise<AvatarSettings> {
    return this.avatar.set(session.user.id, body);
  }
}
