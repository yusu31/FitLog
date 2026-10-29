'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { DEFAULT_NEXT_PATH } from '@/lib/next-path';

// 最初の画面（docs/screen-design.md 2章）: 今日へ移す。ログインしていなければ、今日の枠がログイン画面へ移す。
// 静的書き出しなのでサーバーでの転送は使えず、画面で移す
export default function Home() {
  const router = useRouter();
  useEffect(() => {
    router.replace(DEFAULT_NEXT_PATH);
  }, [router]);
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-2 px-4">
      <h1 className="text-3xl font-black">FitLog</h1>
      <p className="text-sub">少人数で使う、筋トレとランの記録アプリ</p>
    </main>
  );
}
