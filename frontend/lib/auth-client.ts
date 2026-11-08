import { createAuthClient } from 'better-auth/react';

// 認証の窓口（API 側の better-auth と対）。baseURL を指定しないので、今開いているサイトの /api/auth を呼ぶ。
// 画面と API は同じサイトに置く設計（docs/design.md 1章）なので、Cookie がそのまま送られる。
//
// customFetchImpl: better-auth は既定で「作った時点の fetch」を握る。installBodyHash()（SHA-256 を付ける仕組み）が
// 先に fetch を包んでいるとは限らないので、送るたびに今の globalThis.fetch を探す関数を渡す（Issue #162）。
export const authClient = createAuthClient({
  fetchOptions: { customFetchImpl: (...args: Parameters<typeof fetch>) => globalThis.fetch(...args) },
});
