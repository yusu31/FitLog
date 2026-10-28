import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// 画面の部品テスト（利用者に見える形で探して操作する）。Next.js の実行環境は使わず、jsdom（擬似ブラウザ）で動かす。
export default defineConfig({
  plugins: [react()],
  resolve: { tsconfigPaths: true },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['**/*.test.{ts,tsx}'],
    exclude: ['node_modules/**', '.next/**', 'out/**'],
  },
});
