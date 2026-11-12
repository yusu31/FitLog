import { Module } from '@nestjs/common';
import { HeatmapController } from './heatmap.controller.js';
import { RecordsController } from './records.controller.js';
import { StatsController } from './stats.controller.js';
import { RecordsService } from './records.service.js';
import { WeekController } from './week.controller.js';

@Module({
  controllers: [RecordsController, WeekController, HeatmapController, StatsController],
  providers: [RecordsService],
})
export class RecordsModule {}
