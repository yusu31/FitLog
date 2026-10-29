import { GetParametersCommand, SSMClient } from '@aws-sdk/client-ssm';

// 秘密情報を AWS の Parameter Store から読んで、環境変数に入れる（docs/infrastructure.md 8章）。
// Lambda の環境変数に値を直接書くと、Terraform の状態ファイルや AWS の画面に残る。だから値は手で Parameter Store に入れ、起動時に読む。
// 印の環境変数 FITLOG_SSM_PREFIX（例: /fitlog/spike）があるときだけ動く。手元・テストには付けないので、AWS を呼ばない。

// Parameter Store の名前（prefix の下）→ 入れる環境変数
const PARAMETERS = {
  'database-url': 'DATABASE_URL',
  'better-auth-secret': 'BETTER_AUTH_SECRET',
  'better-auth-url': 'BETTER_AUTH_URL',
} as const;

// infra/secrets.tf が、入れ物を作るときに入れておく仮の文字。本物の値を入れ忘れたまま起動しないよう、見つけたら止める
const PLACEHOLDER = 'CHANGE_ME';

// テストで差し替えられるよう、必要な形だけを決める（本物は SSMClient）
export interface SsmLike {
  send(command: GetParametersCommand): Promise<{
    Parameters?: { Name?: string; Value?: string }[];
    InvalidParameters?: string[];
  }>;
}

// 失敗のメッセージには「名前」だけを出す。値（接続文字列・署名鍵）は、メッセージにもログにも出さない（operations.md 1-3）
export async function loadSecretsFromSsm(env: NodeJS.ProcessEnv, client?: SsmLike): Promise<void> {
  const prefix = env.FITLOG_SSM_PREFIX;
  if (!prefix) return;

  // すでに環境変数にあるものは、そちらを優先する（上書きしない。読みにも行かない）
  const wanted = Object.entries(PARAMETERS).filter(([, envName]) => !env[envName]);
  if (wanted.length === 0) return;

  const ssm: SsmLike = client ?? new SSMClient({});
  const names = wanted.map(([key]) => `${prefix}/${key}`);

  let response;
  try {
    // WithDecryption: 暗号化して保存した値（SecureString）を、読むときに元に戻す
    response = await ssm.send(new GetParametersCommand({ Names: names, WithDecryption: true }));
  } catch (cause) {
    throw new Error('Parameter Store から秘密情報を読めませんでした（権限・名前・リージョンを確かめてください）', { cause });
  }

  const found = new Map((response.Parameters ?? []).map((p) => [p.Name, p.Value]));
  const missing = names.filter((n) => !found.has(n));
  if (missing.length > 0) {
    throw new Error(`Parameter Store に値がありません: ${missing.join(', ')}`);
  }
  const unset = names.filter((n) => {
    const value = found.get(n);
    return !value || value === PLACEHOLDER;
  });
  if (unset.length > 0) {
    throw new Error(`Parameter Store の値が仮のままです（本物を入れてください）: ${unset.join(', ')}`);
  }

  // 全部の検査が済んでから入れる（途中まで入った状態で起動しないように）
  for (const [key, envName] of wanted) {
    env[envName] = found.get(`${prefix}/${key}`);
  }
}
