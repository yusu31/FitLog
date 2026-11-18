'use client';

import { useEffect } from 'react';
import { authClient } from '@/lib/auth-client';
import { type CachedUser, clearCachedUser, readCachedUser, writeCachedUser } from '@/lib/session-cache';

// email は、サーバーが確かめた情報があるときだけ入る（端末の控えには持たない）
export type AppSession = { user: CachedUser & { email?: string } };

type RawSession = {
  data: { user: { id: string; name: string; email?: string } } | null;
  isPending: boolean;
  error: { status?: number } | null;
};

// useSession の結果と端末の控えから、画面が使うログイン情報を決める（副作用なし）。
// - サーバーが確かめた情報があれば、それを使い、控えを更新する
// - サーバーが「未ログイン」（エラーなし・データなし、または 401）と答えたら、控えを消す
// - 通信に失敗した（電波なし・5xx）ときは、控えがあればその人として画面を開く
export function resolveSession(
  raw: RawSession,
  cached: CachedUser | null,
): { session: AppSession | null; save: CachedUser | null; clear: boolean } {
  if (raw.data) {
    const user = { id: raw.data.user.id, name: raw.data.user.name };
    return { session: { user: { ...user, email: raw.data.user.email } }, save: user, clear: false };
  }
  // 確認中（S3）: 控えの人として先に画面を開く。Lambda が眠っていると確認に5秒前後かかるため、
  // 待たせずに描き始める。確認が返れば上の分岐で本物に置き換わり、未ログインなら控えを消してログインへ移す。
  // 控えは画面を開くためだけに使い、権限は API が確かめる（design.md 2章）
  if (raw.isPending) return { session: cached ? { user: cached } : null, save: null, clear: false };
  const failed = raw.error !== null && raw.error.status !== 401;
  if (!failed) return { session: null, save: null, clear: true };
  return { session: cached ? { user: cached } : null, save: null, clear: false };
}

// authClient.useSession() の代わりに使う。電波なしで開き直しても、前にログインしていた人なら
// ログイン画面へ飛ばさない（F-30③）。返す形は { data, isPending } で、useSession と同じ使い方ができる
export function useAppSession(): { data: AppSession | null; isPending: boolean } {
  const { data, isPending, error } = authClient.useSession();
  const { session, save, clear } = resolveSession(
    { data: data ?? null, isPending, error: (error as RawSession['error']) ?? null },
    readCachedUser(),
  );
  const saveId = save?.id;
  const saveName = save?.name;
  useEffect(() => {
    if (saveId !== undefined && saveName !== undefined) writeCachedUser({ id: saveId, name: saveName });
    else if (clear) clearCachedUser();
  }, [saveId, saveName, clear]);
  return { data: session, isPending };
}
