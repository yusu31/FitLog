import { defineConfig } from 'orval';

// バックエンドの OpenAPI（backend/openapi.json）から、画面用の型と TanStack Query の部品を生成する（docs/tech-stack.md）。
// 生成物は lib/api/ に置き、Git に入れる。CI は再生成して差分が出たら「古い」と落とす。
export default defineConfig({
  fitlog: {
    input: '../backend/openapi.json',
    output: {
      mode: 'single',
      target: './lib/api/generated.ts',
      client: 'react-query',
      httpClient: 'fetch',
      // 画面と API は同じサイト（CloudFront の下の /api/*）。パスは openapi.json の /api/... のまま相対で呼ぶ
      baseUrl: '',
      clean: true,
    },
  },
});
