import { Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { NotificationListResponse } from './notifications.response.js';
import { NotificationsService } from './notifications.service.js';

// お知らせ（D7-3）。ログイン必須（共通のガードが既定で守る）
@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiOperation({ operationId: 'listNotifications', summary: 'お知らせの一覧（新しい順・直近30日・最大30件）と未読の数。スタンプ／コメントをもらった・仲間が記録した・仲間が加わった' })
  @ApiOkResponse({ type: NotificationListResponse })
  list(@Session() session: UserSession): Promise<NotificationListResponse> {
    return this.notifications.list(session.user.id);
  }

  @Post('seen')
  @HttpCode(204)
  @ApiOperation({ operationId: 'markNotificationsSeen', summary: 'お知らせを見た。未読の基準を今にする。何度呼んでもよい' })
  @ApiNoContentResponse({ description: '基準を今にした' })
  async markSeen(@Session() session: UserSession): Promise<void> {
    await this.notifications.markSeen(session.user.id);
  }
}
