import { Module } from '@nestjs/common';
import { FeedController, SocialController } from './feed.controller.js';
import { FeedService } from './feed.service.js';
import { SocialService } from './social.service.js';

@Module({
  controllers: [FeedController, SocialController],
  providers: [FeedService, SocialService],
})
export class FeedModule {}
