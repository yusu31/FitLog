import { Controller, Get, Inject, Logger, ServiceUnavailableException } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { errorCode } from '../common/error-code.js';
import { DB, Db } from '../db/db.module.js';

@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(@Inject(DB) private readonly db: Pick<Db, 'execute'>) {}

  // DB を見ない浅い確認。サーバーが起動していれば ok
  @Get()
  check() {
    return { status: 'ok' };
  }

  // DB まで届くかの確認。内部の事情（接続文字列・エラー文）は応答に出さず、ログにだけ残す
  @Get('db')
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
