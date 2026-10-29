'use client';

import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { PageTitle } from '@/components/fitlog/app-shell';
import { ThickButton } from '@/components/fitlog/thick-button';
import { authClient } from '@/lib/auth-client';

// S-30 自分（docs/screen-design.md 4章）。ヒートマップ・記録の一覧は記録の機能ができてから。
// ログアウトは本来 S-31 設定に置くが、設定の画面ができるまでここに置く
export function MeView() {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const [error, setError] = useState<string | null>(null);

  async function onSignOut() {
    setError(null);
    try {
      await authClient.signOut();
      router.replace('/login');
    } catch {
      setError('通信に失敗しました。電波の良い所でもう一度お試しください');
    }
  }

  return (
    <>
      <PageTitle>じぶん</PageTitle>
      <div className="space-y-4 px-4 pt-3">
        <section className="fl-slab flex items-center gap-3 px-4 py-3">
          <span
            aria-hidden
            className="flex size-12 shrink-0 items-center justify-center rounded-full bg-teal-dark text-xl font-extrabold text-white"
          >
            {session ? Array.from(session.user.name)[0] : ''}
          </span>
          <div className="min-w-0">
            <p className="truncate text-lg font-extrabold">{session?.user.name}</p>
            <p className="text-xs text-sub">からだの記録とヒートマップは、記録の機能ができたら出ます</p>
          </div>
        </section>
        <ThickButton tone="white" onClick={onSignOut}>
          <LogOut aria-hidden />
          ログアウト
        </ThickButton>
        {error && (
          <p role="alert" className="rounded-lg bg-coral-light px-3 py-2 text-sm font-bold text-ink">
            {error}
          </p>
        )}
      </div>
    </>
  );
}
