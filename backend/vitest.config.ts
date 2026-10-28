import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Resolves the path aliases declared in tsconfig.json, including the ones
  // added by `nest g library`. Requires Vite 8, which ships this option.
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.spec.ts'],
    // better-auth の読み込みが重く（手元で約4〜10秒）、並列で動かすと標準の5秒を超えることがある。本番の起動時間は 02-1 ③b の公開スパイクで実測する
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
