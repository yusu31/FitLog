import { Module } from '@nestjs/common';
import { HeatmapController } from './heatmap.controller.js';
import { RecordsController } from './records.controller.js';
import { RecordsService } from './records.service.js';
import { WeekController } from './week.controller.js';

@Module({
  controllers: [RecordsController, WeekController, HeatmapController],
  providers: [RecordsService],
})
export class RecordsModule {}
