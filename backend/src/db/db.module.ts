import { Global, Inject, Logger, Module, OnApplicationShutdown } from '@nestjs/common';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

export const DB = Symbol('DB');
const PG_POOL = Symbol('PG_POOL');

export type Db = NodePgDatabase;

// Lambda の1つの実行環境につき接続は最大1本（docs/infrastructure.md 5.2章）。
// 接続先は Neon の -pooler 付きホスト。モジュール変数ではなく Nest の1つの Pool を使い回す。
function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL が設定されていません');
  }
  const pool = new Pool({
    connectionString,
    max: 1,
    // Neon は5分使われないと止まり、起きるまで待つ（docs/infrastructure.md 5.1章）
    connectionTimeoutMillis: 10_000,
  });
  // 待機中の接続が切れても、プロセスを落とさない（これは「落とさない」だけ）。
  // 注意: 切れた接続を「張り直す」ことまではできない。Lambda は応答のあと凍結され、凍結中は切断に気づけない。
  // Neon は5分使われないと接続を切るので、5分以上空いた後の最初の1回は失敗しうる（pg-pool は渡す前に接続の生存を確かめない）。
  // 直し方（再試行／毎回つなぐ／作り直す）は、02-1 ③ の公開スパイクで実測してから決める。docs/infrastructure.md 5.2章。
  pool.on('error', (err) => {
    new Logger('Db').warn(`待機中の接続でエラー: ${(err as NodeJS.ErrnoException).code ?? err.name}`);
  });
  return pool;
}

@Global()
@Module({
  providers: [
    { provide: PG_POOL, useFactory: createPool },
    { provide: DB, useFactory: (pool: Pool): Db => drizzle(pool), inject: [PG_POOL] },
  ],
  exports: [DB],
})
export class DbModule implements OnApplicationShutdown {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}
