import { Module } from '@nestjs/common';
import { createVideoStorage, VideoStorage } from './video-storage.js';
import { VideosController } from './videos.controller.js';
import { VideosService } from './videos.service.js';

@Module({
  controllers: [VideosController],
  providers: [VideosService, { provide: VideoStorage, useFactory: () => createVideoStorage() }],
  // 記録を消すとき S3 の動画も消すので、RecordsModule も同じ窓口を使う
  exports: [VideoStorage],
})
export class VideosModule {}
