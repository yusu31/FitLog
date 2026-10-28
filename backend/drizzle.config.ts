import { defineConfig } from 'drizzle-kit';

// マイグレーション（表の作成・変更）は、プーリングなしの直接接続で流す（docs/infrastructure.md 5.2章）。
// API 用の -pooler 付きの接続（DATABASE_URL）とは別に、MIGRATION_DATABASE_URL を必ず指定する。
// 指定がなければ止める: 黙って DATABASE_URL（-pooler 側）で流れるのを防ぐため。
const url = process.env.MIGRATION_DATABASE_URL;
if (!url) {
  throw new Error('MIGRATION_DATABASE_URL が設定されていません（直接接続の URL を指定する。ローカルは .env.example を参照）');
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: { url },
});
