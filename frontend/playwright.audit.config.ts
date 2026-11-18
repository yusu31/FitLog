import { defineConfig, devices } from '@playwright/test';
import base from './playwright.config';

// 総合テスト（02-8）用の監査設定。既存の playwright.config.ts（testMatch: '**/*.spec.ts'）とは別物で、
// '*.audit.ts' だけを実行する。CI（npm run test:e2e）には混ざらない。
// 接続先の安全装置（localhost だけ）・API と画面の起動・マイグレーションは、既存の設定をそのまま使う。
export default defineConfig({
  ...base,
  testDir: './e2e/audit',
  testMatch: '**/*.audit.ts',
  reporter: [['list']],
  // 監査は撮影・計測が長いので余裕を持たせる
  timeout: 120_000,
  use: {
    ...base.use,
    // 動きによる揺れを消す（ビジュアル回帰の基準を安定させるため）
    contextOptions: { reducedMotion: 'reduce' },
  },
  projects: [{ name: 'audit', use: { ...devices['Desktop Chrome'] } }],
});
