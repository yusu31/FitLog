import { execSync } from 'node:child_process';
import { resolveE2eEnv } from './guard';

// テストの前に、表の作成（マイグレーション）をローカルの DB に流す。本番と同じ手順（drizzle-kit）。
// 接続先は guard.ts が localhost だけに制限している。
export default function globalSetup(): void {
  const env = resolveE2eEnv();
  execSync('npm run db:migrate', {
    cwd: '../backend',
    stdio: 'inherit',
    env: { ...process.env, MIGRATION_DATABASE_URL: env.migrationDatabaseUrl },
  });
}
