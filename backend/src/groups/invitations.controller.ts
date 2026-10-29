import { Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiGoneResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AllowAnonymous, Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { ErrorResponse } from '../common/error-response.js';
import { GroupsService } from './groups.service.js';
import { GroupResponse, InvitationPreviewResponse } from './groups.response.js';

// 招待リンクを受け取る側（S-03。docs/design.md 4章）。パスに招待リンクの値が入るが、
// リクエストのログはパスの型（/api/invitations/:token）だけを出すので、値はログに残らない
@ApiTags('invitations')
@Controller('invitations')
export class InvitationsController {
  constructor(private readonly groups: GroupsService) {}

  // ログイン不要の例外（design.md 2章）。未登録の人に「どのグループに招かれたか」を見せる
  @AllowAnonymous()
  @Get(':token')
  @ApiOperation({ operationId: 'getInvitation', summary: '招待の中身（グループ名と今の人数）を見る。ログイン不要' })
  @ApiOkResponse({ type: InvitationPreviewResponse })
  @ApiNotFoundResponse({ type: ErrorResponse, description: '存在しない・取り消し済み（INVITATION_NOT_FOUND）' })
  @ApiGoneResponse({ type: ErrorResponse, description: '期限切れ（INVITATION_EXPIRED）' })
  preview(@Param('token') token: string) {
    return this.groups.previewInvitation(token);
  }

  @Post(':token/accept')
  @HttpCode(200)
  @ApiOperation({ operationId: 'acceptInvitation', summary: '招待リンクでグループに参加する' })
  @ApiOkResponse({ type: GroupResponse })
  @ApiNotFoundResponse({ type: ErrorResponse, description: '存在しない・取り消し済み（INVITATION_NOT_FOUND）' })
  @ApiGoneResponse({ type: ErrorResponse, description: '期限切れ（INVITATION_EXPIRED）' })
  @ApiConflictResponse({ type: ErrorResponse, description: 'すでにグループにいる（ALREADY_IN_GROUP）・満員（GROUP_FULL）' })
  accept(@Session() session: UserSession, @Param('token') token: string) {
    return this.groups.acceptInvitation(session.user.id, token);
  }
}
