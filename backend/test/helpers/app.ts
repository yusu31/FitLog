import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuthGuard } from '@thallesp/nestjs-better-auth';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { vi } from 'vitest';
import { AppModule } from '../../src/app.module.js';
import { setupApp } from '../../src/app.setup.js';

// 結合テスト用の部品。本番の組み立て（src/main.ts）と同じ設定にそろえる:
// src/app.setup.ts の setupApp（接頭辞 api・ログ・リクエスト ID）と、bodyParser: false（連携部品の必須設定）。

export const TEST_ORIGIN = 'http://localhost:3000';

// テスト用の秘密の文字列（本番の値ではない）
export function setAuthEnv(): void {
  process.env.BETTER_AUTH_SECRET ??= 'test-only-secret-at-least-32-characters-long';
  process.env.BETTER_AUTH_URL ??= TEST_ORIGIN;
}

// skipAuth: ログインの検査だけを素通りにする。認証以外の確認（DB に届かないときの応答など）で使う。
// DB に届かない状態ではログイン自体ができないため。認証の確認は auth.e2e-spec.ts が本物でやる。
// overrideGuard は、連携部品が全体に登録する形（APP_GUARD）には効かなかったので、判定の関数を差し替える。
// 使ったテストは afterEach で vi.restoreAllMocks() を呼んで元に戻す。
export async function createApp(databaseUrl: string | undefined, options: { skipAuth?: boolean } = {}): Promise<INestApplication> {
  if (!databaseUrl) throw new Error('DATABASE_URL が設定されていません（docker compose up -d db のあと、.env.example を参照）');
  process.env.DATABASE_URL = databaseUrl;
  setAuthEnv();
  // 普通のテストは WARN 以上だけ出す（出力をうるさくしない）。ログの確認をするテストは LOG_LEVEL=INFO にしてから呼ぶ
  process.env.LOG_LEVEL ??= 'WARN';
  if (options.skipAuth) skipAuthGuard();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication({ bodyParser: false });
  setupApp(app);
  await app.init();
  return app;
}

export function skipAuthGuard(): void {
  vi.spyOn(AuthGuard.prototype, 'canActivate').mockResolvedValue(true);
}

// 表を作る。マイグレーション（drizzle/*.sql）を、アプリと同じ道具で流す。何度流しても同じ結果になる
export async function migrateDb(url: string): Promise<void> {
  const pool = new Pool({ connectionString: url, max: 1 });
  try {
    await migrate(drizzle(pool), { migrationsFolder: './drizzle' });
  } finally {
    await pool.end();
  }
}

// 検査用に DB を直接読む・消す
export async function withPool<T>(url: string, fn: (pool: Pool) => Promise<T>): Promise<T> {
  const pool = new Pool({ connectionString: url, max: 1 });
  try {
    return await fn(pool);
  } finally {
    await pool.end();
  }
}
