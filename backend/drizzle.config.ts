import { defineConfig } from 'drizzle-kit';

// マイグレーション（表の作成・変更）は、プーリングなしの直接接続で流す（docs/infrastructure.md 5.2章）。
// API 用の -pooler 付きの接続とは別に、MIGRATION_DATABASE_URL を使う。無ければ DATABASE_URL。
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL ?? '',
  },
});
