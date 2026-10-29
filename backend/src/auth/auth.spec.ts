import type { Db } from '../db/db.module.js';
import { createAuth } from './auth.js';

// 設定漏れで起動を止める（DB には触れないので、空の db で足りる）
describe('createAuth の必須設定', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });
  const db = {} as Db;

  // T-AUTH-U-01: 秘密の文字列が無ければ起動しない
  it('BETTER_AUTH_SECRET が無ければ起動を止める', () => {
    delete process.env.BETTER_AUTH_SECRET;
    expect(() => createAuth(db)).toThrow('BETTER_AUTH_SECRET');
  });

  // T-AUTH-U-02: 本番で URL が無ければ起動しない（localhost に黙って落とさない）
  it('本番で BETTER_AUTH_URL が無ければ起動を止める', () => {
    process.env.BETTER_AUTH_SECRET = 'x'.repeat(32);
    process.env.NODE_ENV = 'production';
    delete process.env.BETTER_AUTH_URL;
    expect(() => createAuth(db)).toThrow('BETTER_AUTH_URL');
  });

  // T-AUTH-U-03（陽性対照）: 本番でも URL があれば起動する。開発では URL が無くても既定で起動する
  it('URL があれば本番でも起動し、開発では URL が無くても起動する', () => {
    process.env.BETTER_AUTH_SECRET = 'x'.repeat(32);
    process.env.NODE_ENV = 'production';
    process.env.BETTER_AUTH_URL = 'https://fitlog.example';
    expect(() => createAuth(db)).not.toThrow();
    process.env.NODE_ENV = 'development';
    delete process.env.BETTER_AUTH_URL;
    expect(() => createAuth(db)).not.toThrow();
  });
});
