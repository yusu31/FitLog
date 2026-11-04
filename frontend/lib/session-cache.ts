// 「最後に確認できたログイン中の人」を端末に控える。電波なしで開き直したとき、better-auth の
// useSession は通信に失敗して空になり、ログイン画面へ飛ばされてしまう。それを防ぐための控え。
// 控えるのは id と name だけ（トークン・メールは持たない）。控えは「画面を開く」ためだけに使い、
// 本当の認可は API 側（design.md 2章）なので、控えが古くても権限は増えない
const KEY = 'fitlog:last-user';

export type CachedUser = { id: string; name: string };

export function readCachedUser(): CachedUser | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const v: unknown = JSON.parse(raw);
    if (typeof v !== 'object' || v === null) return null;
    const { id, name } = v as Record<string, unknown>;
    if (typeof id !== 'string' || id === '' || typeof name !== 'string') return null;
    return { id, name };
  } catch {
    return null;
  }
}

export function writeCachedUser(user: CachedUser): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ id: user.id, name: user.name }));
  } catch {
    // 保存できない端末（プライベートブラウズ等）では控えなしで動く
  }
}

export function clearCachedUser(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // 同上
  }
}
