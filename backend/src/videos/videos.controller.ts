import { Body, Controller, Delete, Get, Param, Post, Query, Res } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import type { Response } from 'express';
import { ErrorResponse } from '../common/error-response.js';
import { VideosService } from './videos.service.js';
import { CreateVideoUploadRequest, DeleteVideoResponse, MyVideosResponse, VideoUploadResponse, VideoUrlResponse, VideoWeekResponse } from './videos.response.js';

// 動画（F-13。docs/design.md 4章）。すべてログイン必須（共通のガードが既定で守る）
@ApiTags('videos')
@Controller()
export class VideosController {
  constructor(private readonly videos: VideosService) {}

  @Post('records/:id/video')
  @ApiOperation({ operationId: 'issueVideoUpload', summary: '記録（どの種類でも）に付ける動画を置く署名付き POST を発行する。やり直しは同じ記録にもう一度呼ぶ' })
  @ApiCreatedResponse({ type: VideoUploadResponse, description: '新しく発行した（動画の行を作った）' })
  @ApiOkResponse({ type: VideoUploadResponse, description: 'すでに行がある記録への再発行（置くのに失敗したやり直し）。行は申告どおりに更新し、同じキーで署名し直した' })
  @ApiBadRequestResponse({ type: ErrorResponse, description: 'contentType が video/mp4・video/webm でない・sizeBytes が 1〜10,485,760 の整数でない（VALIDATION_ERROR）' })
  @ApiNotFoundResponse({ type: ErrorResponse, description: '記録が無い・他の人の記録（RECORD_NOT_FOUND。存在を教えない）' })
  @ApiConflictResponse({ type: ErrorResponse, description: 'あとから記録した分（RECORD_LATE）' })
  async issueUpload(
    @Session() session: UserSession,
    @Param('id') recordId: string,
    @Body() body: CreateVideoUploadRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<VideoUploadResponse> {
    const { created, video } = await this.videos.issueUpload(session.user.id, recordId, body);
    if (!created) res.status(200);
    return video;
  }

  @Delete('records/:id/video')
  @ApiOperation({ operationId: 'deleteRecordVideo', summary: '記録の動画だけ消す（S3 のファイルも）。投稿の動画を消したら投稿ごと消える（recordDeleted=true）' })
  @ApiOkResponse({ type: DeleteVideoResponse })
  @ApiNotFoundResponse({ type: ErrorResponse, description: '記録が無い・他の人の記録（RECORD_NOT_FOUND）／動画の無い記録（VIDEO_NOT_FOUND）' })
  deleteVideo(@Session() session: UserSession, @Param('id') recordId: string): Promise<DeleteVideoResponse> {
    return this.videos.deleteVideo(session.user.id, recordId);
  }

  @Get('videos/week')
  @ApiOperation({ operationId: 'getVideosThisWeek', summary: '今週の動画の一覧（仲間タブのサムネ列）。自分が今週撮っていなければ unlocked=false（仲間の分は見られない）' })
  @ApiOkResponse({ type: VideoWeekResponse })
  week(@Session() session: UserSession): Promise<VideoWeekResponse> {
    return this.videos.weekList(session.user.id);
  }

  @Get('videos/mine')
  @ApiOperation({ operationId: 'getMyVideos', summary: '自分の過去の動画の一覧（「自分」タブのグリッド）。自分の分は条件なし・新しい順・20件ずつ' })
  @ApiQuery({ name: 'cursor', required: false, description: '前の応答の nextCursor をそのまま渡す（続きを読む）' })
  @ApiOkResponse({ type: MyVideosResponse })
  @ApiBadRequestResponse({ type: ErrorResponse, description: 'cursor が壊れている（VALIDATION_ERROR）' })
  mine(@Session() session: UserSession, @Query('cursor') cursor?: string): Promise<MyVideosResponse> {
    return this.videos.myList(session.user.id, { cursor });
  }

  @Get('videos/:id/url')
  @ApiOperation({ operationId: 'getVideoUrl', summary: '動画を見る署名付き URL を発行する。本人はいつでも・仲間は見られる期限の前だけ' })
  @ApiOkResponse({ type: VideoUrlResponse })
  @ApiNotFoundResponse({ type: ErrorResponse, description: '無い・別のグループの人の動画・グループに入っていない人から見た他人の動画（VIDEO_NOT_FOUND。存在を教えない）' })
  @ApiForbiddenResponse({
    type: ErrorResponse,
    description:
      '仲間が、見られる期限（記録の週の日曜 24:00 日本時間）を過ぎてから見ようとした（FORBIDDEN）／期限前でも、今週まだ自分の動画を撮っていない（VIDEO_LOCKED。「あなたも2秒撮ると見られます」）',
  })
  url(@Session() session: UserSession, @Param('id') id: string): Promise<VideoUrlResponse> {
    return this.videos.viewUrl(session.user.id, id);
  }
}
