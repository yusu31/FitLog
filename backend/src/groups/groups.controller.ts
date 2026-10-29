import { Body, Controller, Delete, Get, HttpCode, Param, Post } from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { ErrorResponse } from '../common/error-response.js';
import { GroupsService } from './groups.service.js';
import { CreateGroupRequest, GroupDetailResponse, GroupResponse, InvitationCreatedResponse } from './groups.response.js';

// グループと招待（F-02。docs/design.md 4章）。すべてログイン必須（共通のガードが既定で守る）
@ApiTags('groups')
@Controller('groups')
export class GroupsController {
  constructor(private readonly groups: GroupsService) {}

  @Post()
  @ApiOperation({ operationId: 'createGroup', summary: 'グループを作る（作った人が最初のメンバー）' })
  @ApiCreatedResponse({ type: GroupResponse })
  @ApiConflictResponse({ type: ErrorResponse, description: 'すでにグループにいる（ALREADY_IN_GROUP）' })
  create(@Session() session: UserSession, @Body() body: CreateGroupRequest) {
    return this.groups.createGroup(session.user.id, body?.name);
  }

  @Get('current')
  @ApiOperation({ operationId: 'getCurrentGroup', summary: '今のグループとメンバーを返す' })
  @ApiOkResponse({ type: GroupDetailResponse })
  @ApiNotFoundResponse({ type: ErrorResponse, description: 'グループに入っていない' })
  current(@Session() session: UserSession) {
    return this.groups.getCurrent(session.user.id);
  }

  @Post('current/invitations')
  @ApiOperation({ operationId: 'createInvitation', summary: '招待リンクを作る（値はこの応答の1回だけ）' })
  @ApiCreatedResponse({ type: InvitationCreatedResponse })
  @ApiNotFoundResponse({ type: ErrorResponse, description: 'グループに入っていない' })
  createInvitation(@Session() session: UserSession) {
    return this.groups.createInvitation(session.user.id);
  }

  @Delete('current/invitations/:id')
  @HttpCode(204)
  @ApiOperation({ operationId: 'revokeInvitation', summary: '招待リンクを取り消す（2回目以降も 204）' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ type: ErrorResponse, description: '自分のグループの招待ではない・存在しない' })
  async revokeInvitation(@Session() session: UserSession, @Param('id') id: string): Promise<void> {
    await this.groups.revokeInvitation(session.user.id, id);
  }

  @Delete('current/members/me')
  @HttpCode(204)
  @ApiOperation({ operationId: 'leaveGroup', summary: 'グループを出る（グループは残る）' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ type: ErrorResponse, description: 'グループに入っていない' })
  async leave(@Session() session: UserSession): Promise<void> {
    await this.groups.leaveGroup(session.user.id);
  }
}
