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
      // clean: true だと、出力先（lib/api/）の中身を全部消してから生成する。同じ場所に置いた
      // テスト（mutation-key.test.ts）と fixtures まで消え、CI でそのテストが実行されなかった（Issue #81）。
      // generated.ts は毎回上書きされるので、false で足りる
      clean: false,
    },
  },
});
