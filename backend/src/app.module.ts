import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { AuthModule } from '@thallesp/nestjs-better-auth';
import { createAuth } from './auth/auth.js';
import { AllExceptionsFilter } from './common/all-exceptions.filter.js';
import { DB, Db, DbModule } from './db/db.module.js';
import { GroupsModule } from './groups/groups.module.js';
import { HealthController } from './health/health.controller.js';

@Module({
  imports: [
    DbModule,
    GroupsModule,
    // 連携部品（@thallesp/nestjs-better-auth を 2.8.0 に固定。判断ログ 02-1-3）。
    // 全 API を「ログイン必須」にする共通のガードを入れる。例外は @AllowAnonymous() を付けた道だけ。
    // CORS は使わない: 画面と同じサイトで動かす（/api/* を CloudFront の下に置く）ので、連携部品が勝手に有効にするのを止める。
    AuthModule.forRootAsync({
      inject: [DB],
      useFactory: (db: Db) => ({ auth: createAuth(db), disableTrustedOriginsCors: true }),
    }),
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_FILTER, useClass: AllExceptionsFilter }],
})
export class AppModule {}
