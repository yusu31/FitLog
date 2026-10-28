import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import type { Db } from '../db/db.module.js';
import * as schema from '../db/schema.js';

// 認証の設定（docs/design.md 2章）。メール＋パスワードで登録・ログインし、Cookie でセッションを持つ。
// 受け付けるパスは /api/auth/*（sign-up/email・sign-in/email・sign-out・get-session ほか）。
export function createAuth(db: Db) {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) {
    throw new Error('BETTER_AUTH_SECRET が設定されていません（32文字以上の秘密の文字列。ローカルは .env.example を参照）');
  }
  return betterAuth({
    secret,
    // 画面と同じサイトで動かす（/api/* を CloudFront の下に置く）。Cookie は同じサイトにだけ付く
    baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:3000',
    basePath: '/api/auth',
    // usePlural: 表名を複数形（users・sessions・accounts・verifications）にする（docs/database-design.md）
    database: drizzleAdapter(db, { provider: 'pg', usePlural: true, schema }),
    emailAndPassword: {
      enabled: true,
      // 登録時のメール確認・パスワード再設定は作らない（docs/requirements.md「やらない」・判断ログ 01-7 決定5）
      requireEmailVerification: false,
      // 登録したらそのままログイン済みにする（S-02 から今日の画面へ移れるように）
      autoSignIn: true,
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
