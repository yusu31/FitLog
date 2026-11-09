import { describe, expect, it } from 'vitest';
import { resolveE2eEnv } from './guard';

describe('E2E の安全装置', () => {
  it('何も指定しなければ localhost の既定値になる', () => {
    const env = resolveE2eEnv({});
    expect(env.baseUrl).toBe('http://localhost:3001');
    expect(env.databaseUrl).toContain('localhost');
  });

  it('公開 URL が指定されたら拒否する', () => {
    expect(() => resolveE2eEnv({ E2E_BASE_URL: 'https://fitlog.example.com' })).toThrow('自分のパソコン以外');
  });

  it('localhost 以外の DB（Neon など）が指定されたら拒否する', () => {
    expect(() => resolveE2eEnv({ E2E_DATABASE_URL: 'postgres://u:p@ep-x-pooler.neon.tech/db' })).toThrow('自分のパソコン以外');
    expect(() => resolveE2eEnv({ E2E_MIGRATION_DATABASE_URL: 'postgres://u:p@db.example.com/db' })).toThrow('自分のパソコン以外');
  });

  it('localhost に見せかけた別ホスト名も拒否する', () => {
    expect(() => resolveE2eEnv({ E2E_BASE_URL: 'http://localhost.evil.com' })).toThrow('自分のパソコン以外');
  });

  it('URL でない値は拒否する', () => {
    expect(() => resolveE2eEnv({ E2E_BASE_URL: 'not a url' })).toThrow('URL として読めません');
  });
});
