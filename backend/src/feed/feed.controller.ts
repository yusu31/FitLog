import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query, Res } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import type { Response } from 'express';
import { ErrorResponse } from '../common/error-response.js';
import { CommentResponse, CreateCommentRequest, CreateReactionRequest, FeedResponse, ReactionResponse } from './feed.response.js';
import { FeedService } from './feed.service.js';
import { SocialService } from './social.service.js';

// 仲間の足跡（F-09）。ログイン必須（共通のガードが既定で守る）
@ApiTags('feed')
@Controller('feed')
export class FeedController {
  constructor(private readonly feed: FeedService) {}

  @Get()
  @ApiOperation({ operationId: 'getFeed', summary: '同じグループのその週の足跡（新しい順・20件ずつ）と、その週の合計を返す' })
  @ApiQuery({ name: 'weekStart', required: true, example: '2026-10-26', description: '日本時間の日付（YYYY-MM-DD）。この日を含む週（月曜〜日曜）を返す' })
  @ApiQuery({ name: 'cursor', required: false, description: '前の応答の nextCursor をそのまま渡す（続きを読む）' })
  @ApiOkResponse({ type: FeedResponse })
  @ApiBadRequestResponse({ type: ErrorResponse, description: 'weekStart が実在する YYYY-MM-DD でない・無い、cursor が壊れている（VALIDATION_ERROR）' })
  getFeed(@Session() session: UserSession, @Query('weekStart') weekStart?: string, @Query('cursor') cursor?: string) {
    return this.feed.feed(session.user.id, { weekStart, cursor });
  }
}

// スタンプとコメント（F-10）。パスが records/ と comments/ にまたがるので、1つの Controller にまとめる
@ApiTags('feed')
@Controller()
export class SocialController {
  constructor(private readonly social: SocialService) {}

  @Post('records/:id/reactions')
  @ApiOperation({ operationId: 'addReaction', summary: '記録にスタンプを付ける。冪等（同じ人が同じスタンプを2回付けても1件のまま）' })
  @ApiCreatedResponse({ type: ReactionResponse, description: '新しく付けた' })
  @ApiOkResponse({ type: ReactionResponse, description: 'すでに付いている（同じ id の再送、または同じスタンプの二重付与）。付いているスタンプを返す' })
  @ApiBadRequestResponse({ type: ErrorResponse, description: 'id が UUID でない・stampKey が一覧にない（VALIDATION_ERROR）' })
  @ApiNotFoundResponse({ type: ErrorResponse, description: '記録が無い・別のグループの人の記録（RECORD_NOT_FOUND）、他の人のスタンプと同じ id（REACTION_NOT_FOUND）。存在を教えない' })
  @ApiConflictResponse({ type: ErrorResponse, description: '記録の種類に合わないスタンプ（休みに通常のスタンプ・筋トレ／ランに休み用のスタンプ。RECORD_KIND_MISMATCH）' })
  async addReaction(
    @Session() session: UserSession,
    @Param('id') recordId: string,
    @Body() body: CreateReactionRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ReactionResponse> {
    const { created, reaction } = await this.social.addReaction(session.user.id, recordId, body);
    if (!created) res.status(200);
    return reaction;
  }

  @Delete('records/:id/reactions/:reactionId')
  @HttpCode(204)
  @ApiOperation({ operationId: 'deleteReaction', summary: '自分のスタンプを外す' })
  @ApiNoContentResponse({ description: '外した' })
  @ApiNotFoundResponse({ type: ErrorResponse, description: '記録が無い・別のグループの人の記録（RECORD_NOT_FOUND）、その記録にそのスタンプが無い・もう外した（REACTION_NOT_FOUND）' })
  @ApiForbiddenResponse({ type: ErrorResponse, description: '他の人のスタンプ（FORBIDDEN）' })
  async deleteReaction(@Session() session: UserSession, @Param('id') id: string, @Param('reactionId') reactionId: string): Promise<void> {
    await this.social.deleteReaction(session.user.id, id, reactionId);
  }

  @Post('records/:id/comments')
  @ApiOperation({ operationId: 'addComment', summary: '記録にコメント（1〜50字）を付ける。冪等' })
  @ApiCreatedResponse({ type: CommentResponse, description: '新しく付けた' })
  @ApiOkResponse({ type: CommentResponse, description: 'すでにある（同じ id の再送）。1回目の内容を返す' })
  @ApiBadRequestResponse({ type: ErrorResponse, description: 'id が UUID でない・body が空／空白だけ／51字以上（VALIDATION_ERROR）' })
  @ApiNotFoundResponse({ type: ErrorResponse, description: '記録が無い・別のグループの人の記録（RECORD_NOT_FOUND）、他の人のコメントと同じ id（COMMENT_NOT_FOUND）。存在を教えない' })
  async addComment(
    @Session() session: UserSession,
    @Param('id') recordId: string,
    @Body() body: CreateCommentRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<CommentResponse> {
    const { created, comment } = await this.social.addComment(session.user.id, recordId, body);
    if (!created) res.status(200);
    return comment;
  }

  @Delete('comments/:id')
  @HttpCode(204)
  @ApiOperation({ operationId: 'deleteComment', summary: '自分のコメントを消す' })
  @ApiNoContentResponse({ description: '消した' })
  @ApiNotFoundResponse({ type: ErrorResponse, description: 'コメントが無い・もう消した・別のグループの人の記録のコメント（COMMENT_NOT_FOUND）' })
  @ApiForbiddenResponse({ type: ErrorResponse, description: '他の人のコメント（FORBIDDEN）' })
  async deleteComment(@Session() session: UserSession, @Param('id') id: string): Promise<void> {
    await this.social.deleteComment(session.user.id, id);
  }
}
