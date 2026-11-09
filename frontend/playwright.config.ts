import { defineConfig, devices } from '@playwright/test';
import { resolveE2eEnv } from './e2e/guard';

// E2E スモーク（docs/testing-design.md 2-4）。本物のブラウザ（Chromium）で、画面 → API → DB を通す。
// 接続先は localhost とローカルの Docker の DB だけ。localhost 以外が指定されたら、ここで例外になり実行されない。
const env = resolveE2eEnv();

// API（NestJS・3000番）に渡す環境変数。画面（next dev・3001番）が /api/* を 3000 番へ転送する（next.config.ts）
const apiEnv = {
  DATABASE_URL: env.databaseUrl,
  MIGRATION_DATABASE_URL: env.migrationDatabaseUrl,
  // テスト専用のダミー（本番の値ではない）
  BETTER_AUTH_SECRET: 'e2e-only-not-a-real-secret-e2e-only-not-a-real-secret',
  BETTER_AUTH_URL: 'http://localhost:3000',
  BETTER_AUTH_TRUSTED_ORIGINS: env.baseUrl,
  LOG_LEVEL: 'WARN',
  PORT: '3000',
};

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  globalSetup: './e2e/global-setup.ts',
  // .only の取り残しを CI で止める（docs/testing-design.md 6章）
  forbidOnly: !!process.env.CI,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: { baseURL: env.baseUrl, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      // API: ビルドして本番と同じ形（node dist/main）で起動する
      command: 'npm run build && node dist/main',
      cwd: '../backend',
      env: apiEnv,
      url: 'http://localhost:3000/api/health',
      // すでに動いているサーバー（開発用の DB につながっているかもしれない）を使い回さない
      reuseExistingServer: false,
      timeout: 180_000,
    },
    {
      command: 'npm run dev',
      env: { NODE_ENV: 'development' },
      url: env.baseUrl,
      reuseExistingServer: false,
      timeout: 180_000,
    },
  ],
});
