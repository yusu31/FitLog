import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // better-auth の読み込みが重く（手元で約4〜10秒）、並列で動かすと標準の5秒を超えることがある。本番の起動時間は 02-1 ③b の公開スパイクで実測する
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // 結合テストは同じ DB を使い、ファイルごとに表を空にする（TRUNCATE）。同時に走ると、片方が消した行をもう片方が使おうとして落ちる。
    // 1ファイルずつ順番に走らせる。
    fileParallelism: false,
  },
});
