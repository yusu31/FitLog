import { Module } from '@nestjs/common';
import { createVideoStorage, VideoStorage } from './video-storage.js';
import { VideosController } from './videos.controller.js';
import { VideosService } from './videos.service.js';

@Module({
  controllers: [VideosController],
  providers: [VideosService, { provide: VideoStorage, useFactory: () => createVideoStorage() }],
})
export class VideosModule {}
