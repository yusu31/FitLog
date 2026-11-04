import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readCachedUser, writeCachedUser } from './session-cache';
import { useRequireSession } from './use-require-session';

const replace = vi.fn();
let raw: { data: unknown; isPending: boolean; error: unknown };
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }), usePathname: () => '/today/' }));
vi.mock('@/lib/auth-client', () => ({ authClient: { useSession: () => raw } }));

describe('useRequireSession（電波なしで開き直したとき）', () => {
  beforeEach(() => {
    replace.mockClear();
    localStorage.clear();
  });

  it('通信に失敗し、控えがあれば、ログイン中として扱い、ログイン画面へ飛ばさない', () => {
    writeCachedUser({ id: 'u1', name: 'A' });
    raw = { data: null, isPending: false, error: { status: 0 } };
    const { result } = renderHook(() => useRequireSession());
    expect(result.current.signedIn).toBe(true);
    expect(replace).not.toHaveBeenCalled();
  });

  it('通信に失敗し、控えが無ければ、ログイン画面へ移す', () => {
    raw = { data: null, isPending: false, error: { status: 0 } };
    renderHook(() => useRequireSession());
    expect(replace).toHaveBeenCalledWith('/login?next=%2Ftoday%2F');
  });

  it('サーバーが「未ログイン」と答えたら、控えがあってもログイン画面へ移し、控えを消す', () => {
    writeCachedUser({ id: 'u1', name: 'A' });
    raw = { data: null, isPending: false, error: null };
    renderHook(() => useRequireSession());
    expect(replace).toHaveBeenCalledWith('/login?next=%2Ftoday%2F');
    expect(readCachedUser()).toBeNull();
  });

  it('サーバーがログイン中と確かめたら、控えを更新する', () => {
    raw = { data: { user: { id: 'u2', name: 'B', email: 'b@example.com' } }, isPending: false, error: null };
    renderHook(() => useRequireSession());
    expect(readCachedUser()).toEqual({ id: 'u2', name: 'B' });
  });
});
