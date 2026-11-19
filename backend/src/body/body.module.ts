import { Module } from '@nestjs/common';
import { BodyController } from './body.controller.js';
import { BodyService } from './body.service.js';

@Module({
  controllers: [BodyController],
  providers: [BodyService],
})
export class BodyModule {}
