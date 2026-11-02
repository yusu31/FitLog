import { Module } from '@nestjs/common';
import { RecordsController } from './records.controller.js';
import { RecordsService } from './records.service.js';
import { WeekController } from './week.controller.js';

@Module({
  controllers: [RecordsController, WeekController],
  providers: [RecordsService],
})
export class RecordsModule {}
