// E2E の安全装置: 接続先が「自分のパソコンの中」だけであることを確かめる。
// 公開 URL や本物の DB（Neon など）が指定されたら、実行する前に止める。
// 画面とテスト用ユーザーを作る相手が本番だと、本物のデータを汚すため。

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

export function assertLocalUrl(label: string, value: string): void {
  let host: string;
  try {
    host = new URL(value).hostname;
  } catch {
    throw new Error(`${label} が URL として読めません。E2E を止めました`);
  }
  if (!LOCAL_HOSTS.has(host)) {
    throw new Error(
      `${label} の接続先が自分のパソコン以外（${host}）です。E2E はローカルの Docker の DB と localhost の画面にだけ接続します。実行を止めました`,
    );
  }
}

export type E2eEnv = {
  baseUrl: string;
  databaseUrl: string;
  migrationDatabaseUrl: string;
};

// 環境変数で切り替えられるが、どれも localhost 以外は拒否する。
// 既定はローカルの docker compose の「結合テスト専用 DB（fitlog_test）」（開発用の fitlog は汚さない）。
export function resolveE2eEnv(env: Record<string, string | undefined> = process.env): E2eEnv {
  const resolved: E2eEnv = {
    baseUrl: env.E2E_BASE_URL ?? 'http://localhost:3001',
    databaseUrl: env.E2E_DATABASE_URL ?? 'postgres://fitlog:fitlog@localhost:6434/fitlog_test',
    migrationDatabaseUrl: env.E2E_MIGRATION_DATABASE_URL ?? 'postgres://fitlog:fitlog@localhost:5434/fitlog_test',
  };
  assertLocalUrl('E2E_BASE_URL', resolved.baseUrl);
  assertLocalUrl('E2E_DATABASE_URL', resolved.databaseUrl);
  assertLocalUrl('E2E_MIGRATION_DATABASE_URL', resolved.migrationDatabaseUrl);
  return resolved;
}
