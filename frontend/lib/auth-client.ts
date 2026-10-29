import { createAuthClient } from 'better-auth/react';

// 認証の窓口（API 側の better-auth と対）。baseURL を指定しないので、今開いているサイトの /api/auth を呼ぶ。
// 画面と API は同じサイトに置く設計（docs/design.md 1章）なので、Cookie がそのまま送られる。
export const authClient = createAuthClient();
