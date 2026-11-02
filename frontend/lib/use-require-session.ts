'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { authClient } from '@/lib/auth-client';

// タブの無い画面（種目を選ぶ・記録）用の、ログインの案内。AppShell と同じ考え方で、
// ログインしていなければ、戻り先（クエリつき）を付けてログイン画面へ移す。
// 静的書き出しなのでサーバーでは確かめられない。本当の守りは API 側のログイン必須（design.md 2章）
export function useRequireSession(): { signedIn: boolean } {
  const router = useRouter();
  const pathname = usePathname() ?? '/today';
  const { data: session, isPending } = authClient.useSession();
  const signedOut = !isPending && !session;

  useEffect(() => {
    if (signedOut) {
      const search = typeof window === 'undefined' ? '' : window.location.search;
      router.replace(`/login?next=${encodeURIComponent(pathname + search)}`);
    }
  }, [signedOut, router, pathname]);

  return { signedIn: !!session };
}
