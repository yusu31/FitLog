'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

// 古い URL（/today・/me/stats）を新しい場所へ移す。ブックマーク・古い通知・ホーム画面のショートカットが切れないように。
// 静的書き出しなのでサーバーでの転送は使えず、画面で移す。?day=・?metric= と #japan-trek はそのまま引き継ぐ
export function LegacyRedirect({ to }: { to: string }) {
  const router = useRouter();
  useEffect(() => {
    router.replace(`${to}${window.location.search}${window.location.hash}`);
  }, [router, to]);
  return (
    <main aria-busy="true" aria-label="移動中" className="flex min-h-dvh items-center justify-center">
      <p className="text-sm font-bold text-fg-muted">移動しています…</p>
    </main>
  );
}
