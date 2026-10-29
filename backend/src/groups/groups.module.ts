import { Module } from '@nestjs/common';
import { GroupsController } from './groups.controller.js';
import { GroupsService } from './groups.service.js';
import { InvitationsController } from './invitations.controller.js';

@Module({
  controllers: [GroupsController, InvitationsController],
  providers: [GroupsService],
})
export class GroupsModule {}
