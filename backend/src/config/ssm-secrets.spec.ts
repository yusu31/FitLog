import type { GetParametersCommand } from '@aws-sdk/client-ssm';
import { loadSecretsFromSsm, type SsmLike } from './ssm-secrets.js';

// AWS には触れない。Parameter Store の応答はモックで返す（本物の確認は 02-1 ③b の公開スパイク）。
const PREFIX = '/fitlog/spike';

function fakeSsm(values: Record<string, string>, invalid: string[] = []) {
  const calls: { Names?: string[]; WithDecryption?: boolean }[] = [];
  const client: SsmLike = {
    send: (command: GetParametersCommand) => {
      calls.push(command.input);
      const names = command.input.Names ?? [];
      return Promise.resolve({
        Parameters: names.filter((n) => n in values).map((n) => ({ Name: n, Value: values[n] })),
        InvalidParameters: [...invalid, ...names.filter((n) => !(n in values) && !invalid.includes(n))],
      });
    },
  };
  return { client, calls };
}

const allValues = {
  [`${PREFIX}/database-url`]: 'postgres://u:pw-DB-SECRET@host/db',
  [`${PREFIX}/better-auth-secret`]: 'auth-SECRET-0123456789-0123456789-0123',
  [`${PREFIX}/better-auth-url`]: 'https://abc.cloudfront.net',
};

describe('loadSecretsFromSsm', () => {
  // T-SSM-01: 印（FITLOG_SSM_PREFIX）が無ければ、何もしない（手元・テストでは AWS を呼ばない）
  it('FITLOG_SSM_PREFIX が無ければ、Parameter Store を呼ばず、環境変数も変えない', async () => {
    const { client, calls } = fakeSsm(allValues);
    const env: NodeJS.ProcessEnv = {};
    await loadSecretsFromSsm(env, client);
    expect(calls).toHaveLength(0);
    expect(env).toEqual({});
  });

  // T-SSM-02: 3つの値を暗号化を解いて読み、環境変数に入れる
  it('3つの値を復号つきで読んで、環境変数に入れる', async () => {
    const { client, calls } = fakeSsm(allValues);
    const env: NodeJS.ProcessEnv = { FITLOG_SSM_PREFIX: PREFIX };
    await loadSecretsFromSsm(env, client);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.WithDecryption).toBe(true);
    expect([...(calls[0]?.Names ?? [])].sort()).toEqual(Object.keys(allValues).sort());
    expect(env.DATABASE_URL).toBe('postgres://u:pw-DB-SECRET@host/db');
    expect(env.BETTER_AUTH_SECRET).toBe('auth-SECRET-0123456789-0123456789-0123');
    expect(env.BETTER_AUTH_URL).toBe('https://abc.cloudfront.net');
  });

  // T-SSM-03: すでに環境変数があれば、そちらを優先し、その名前は読みにも行かない
  it('すでにある環境変数は上書きせず、読みにも行かない', async () => {
    const { client, calls } = fakeSsm(allValues);
    const env: NodeJS.ProcessEnv = { FITLOG_SSM_PREFIX: PREFIX, DATABASE_URL: 'postgres://local/own' };
    await loadSecretsFromSsm(env, client);
    expect(env.DATABASE_URL).toBe('postgres://local/own');
    expect(calls[0]?.Names).not.toContain(`${PREFIX}/database-url`);
    expect(env.BETTER_AUTH_URL).toBe('https://abc.cloudfront.net');
  });

  // T-SSM-04: 全部すでにあれば、呼ばない
  it('3つとも環境変数にあれば、Parameter Store を呼ばない', async () => {
    const { client, calls } = fakeSsm(allValues);
    const env: NodeJS.ProcessEnv = {
      FITLOG_SSM_PREFIX: PREFIX,
      DATABASE_URL: 'a',
      BETTER_AUTH_SECRET: 'b',
      BETTER_AUTH_URL: 'c',
    };
    await loadSecretsFromSsm(env, client);
    expect(calls).toHaveLength(0);
  });

  // T-SSM-05: 足りない値があれば、起動を止める。メッセージには名前だけを出し、他の値は出さない
  it('値が足りなければ、名前だけを出して失敗する（他の値は出さない）', async () => {
    const { client } = fakeSsm({ [`${PREFIX}/database-url`]: 'postgres://u:pw-DB-SECRET@host/db' });
    const env: NodeJS.ProcessEnv = { FITLOG_SSM_PREFIX: PREFIX };
    const error = await loadSecretsFromSsm(env, client).then(
      () => undefined,
      (e: unknown) => e as Error,
    );
    expect(error?.message).toContain('better-auth-secret');
    expect(error?.message).toContain('better-auth-url');
    expect(error?.message).not.toContain('pw-DB-SECRET');
  });

  // T-SSM-06: 仮の文字（CHANGE_ME）のままなら、入れ忘れとして止める。値そのものは出さない
  it.each(['CHANGE_ME', ''])('値が %j のままなら、入れ忘れとして失敗する', async (placeholder) => {
    const { client } = fakeSsm({ ...allValues, [`${PREFIX}/better-auth-secret`]: placeholder });
    const env: NodeJS.ProcessEnv = { FITLOG_SSM_PREFIX: PREFIX };
    const error = await loadSecretsFromSsm(env, client).then(
      () => undefined,
      (e: unknown) => e as Error,
    );
    expect(error?.message).toContain('better-auth-secret');
    expect(error?.message).not.toContain('pw-DB-SECRET');
    expect(env.DATABASE_URL).toBeUndefined(); // 検査の前に環境変数へ入れない（途中まで入った状態で起動しない）
  });

  // T-SSM-07: Parameter Store に届かない・権限が無いとき。原因（cause）は残し、メッセージは固定の文言
  it('Parameter Store から読めなければ、固定の文言で失敗し、原因を cause に残す', async () => {
    const boom = new Error('AccessDeniedException: not authorized');
    const client: SsmLike = { send: () => Promise.reject(boom) };
    const env: NodeJS.ProcessEnv = { FITLOG_SSM_PREFIX: PREFIX };
    const error = await loadSecretsFromSsm(env, client).then(
      () => undefined,
      (e: unknown) => e as Error,
    );
    expect(error?.message).toContain('Parameter Store');
    expect(error?.cause).toBe(boom);
  });
});
