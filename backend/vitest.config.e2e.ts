import { defineConfig } from 'vitest/config';

// 手元では、開発の DB（fitlog）ではなく結合テスト専用の DB（fitlog_test）を使う。
// テストは毎回 users を空にするので、同じ DB だと開発のアカウントが消える（Issue #88）。
// TEST_* が無いとき（CI）は、DATABASE_URL をそのまま使う（CI の DB は使い捨て）
const testDb = process.env.TEST_DATABASE_URL
  ? {
      DATABASE_URL: process.env.TEST_DATABASE_URL,
      MIGRATION_DATABASE_URL: process.env.TEST_MIGRATION_DATABASE_URL ?? process.env.TEST_DATABASE_URL,
    }
  : {};

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    env: testDb,
    // better-auth の読み込みが重く（手元で約4〜10秒）、並列で動かすと標準の5秒を超えることがある。本番の起動時間は 02-1 ③b の公開スパイクで実測する
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // 結合テストは同じ DB を使い、ファイルごとに表を空にする（TRUNCATE）。同時に走ると、片方が消した行をもう片方が使おうとして落ちる。
    // 1ファイルずつ順番に走らせる。
    fileParallelism: false,
  },
});
