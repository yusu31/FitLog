import { Module } from '@nestjs/common';
import { AvatarController } from './avatar.controller.js';
import { AvatarService } from './avatar.service.js';

@Module({
  controllers: [AvatarController],
  providers: [AvatarService],
})
export class AvatarModule {}
