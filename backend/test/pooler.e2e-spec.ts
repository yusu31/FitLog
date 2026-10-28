import { Pool } from 'pg';

// 結合テストの接続先（DATABASE_URL）が、トランザクションモードの PgBouncer を通っていることの確認。
// 本番の Neon の -pooler と同じ制約（SET・セッション単位のロック・PREPARE が使えない）でテストするための前提。
// PgBouncer は default_pool_size=1（docker-compose.yml）なので、別々の接続の問い合わせが、同じ1本のサーバー接続を使い回す。
// 直接つないでいれば、接続ごとに別のサーバープロセスになり、このテストは落ちる（陽性対照は下のテスト）。
const poolerUrl = process.env.DATABASE_URL;
const directUrl = process.env.MIGRATION_DATABASE_URL;

async function backendPidsOfTwoConnections(url: string): Promise<[number, number]> {
  const a = new Pool({ connectionString: url, max: 1 });
  const b = new Pool({ connectionString: url, max: 1 });
  try {
    // 2つの接続を同時に開いたまま（アイドルにせず）問い合わせる
    const [ra, rb] = await Promise.all([a.query('select pg_backend_pid() as pid'), b.query('select pg_backend_pid() as pid')]);
    return [ra.rows[0].pid, rb.rows[0].pid];
  } finally {
    await Promise.all([a.end(), b.end()]);
  }
}

describe('接続先の確認（結合）', () => {
  // T-POOL-01: DATABASE_URL は PgBouncer 経由
  it('DATABASE_URL の2つの接続は、同じサーバー接続を使い回している（PgBouncer のトランザクションモード）', async () => {
    if (!poolerUrl) throw new Error('DATABASE_URL が設定されていません');
    const [x, y] = await backendPidsOfTwoConnections(poolerUrl);
    expect(x).toBe(y);
  });

  // T-POOL-02（陽性対照）: 直接つなぐと別々のサーバープロセスになる。上のテストが「通るだけ」ではないことの証拠
  it('（陽性対照）直接接続の2つの接続は、別々のサーバープロセスになる', async () => {
    if (!directUrl) throw new Error('MIGRATION_DATABASE_URL が設定されていません');
    const [x, y] = await backendPidsOfTwoConnections(directUrl);
    expect(x).not.toBe(y);
  });
});
