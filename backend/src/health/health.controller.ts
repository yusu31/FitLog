import { Controller, Get, Inject, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { sql } from 'drizzle-orm';
import { errorCode } from '../common/error-code.js';
import { ErrorResponse } from '../common/error-response.js';
import { DB, Db } from '../db/db.module.js';
import { HealthDbResponse, HealthResponse } from './health.response.js';

@ApiTags('health')
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(@Inject(DB) private readonly db: Pick<Db, 'execute'>) {}

  // DB を見ない浅い確認。サーバーが起動していれば ok。ログイン不要（監視ツールが Cookie なしで呼ぶ）
  @AllowAnonymous()
  @Get()
  @ApiOperation({ operationId: 'getHealth', summary: '生きているかの確認（DB には触れない）' })
  @ApiOkResponse({ type: HealthResponse })
  check() {
    return { status: 'ok' };
  }

  // DB まで届くかの確認。内部の事情（接続文字列・エラー文）は応答に出さず、ログにだけ残す
  @Get('db')
  @ApiOperation({ operationId: 'getHealthDb', summary: 'DB まで届くかの確認' })
  @ApiOkResponse({ type: HealthDbResponse })
  @ApiServiceUnavailableResponse({ type: ErrorResponse })
  async checkDb() {
    try {
      await this.db.execute(sql`select 1`);
      return { status: 'ok', db: 'ok' };
    } catch (err) {
      this.logger.error(`DB に接続できません: ${errorCode(err)}`);
      throw new ServiceUnavailableException({
        code: 'DB_UNAVAILABLE',
        message: 'データベースに接続できません',
        details: null,
      });
    }
  }
}
