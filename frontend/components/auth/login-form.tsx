'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authClient } from '@/lib/auth-client';
import { safeNextPath, withNext } from '@/lib/next-path';

// S-01 ログイン（docs/screen-design.md）。成功したら ?next= の画面（既定は今日）へ移る。
// 失敗の理由は「メールが無い」「パスワードが違う」を分けずに伝える（登録済みのメールを探られないため）。
export function LoginForm() {
  const router = useRouter();
  const next = safeNextPath(useSearchParams().get('next'));
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    try {
      const { error: authError } = await authClient.signIn.email({
        email: String(form.get('email')),
        password: String(form.get('password')),
      });
      if (authError) {
        setError('メールアドレスかパスワードが違います');
        return;
      }
      router.replace(next);
    } catch {
      setError('通信に失敗しました。電波の良い所でもう一度お試しください');
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-4">
      <h1 className="text-2xl font-bold">ログイン</h1>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">メールアドレス</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">パスワード</Label>
          <Input id="password" name="password" type="password" autoComplete="current-password" required />
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" disabled={pending}>
          {pending ? 'ログイン中…' : 'ログイン'}
        </Button>
      </form>
      <p className="text-sm text-muted-foreground">
        はじめての方は <Link href={withNext('/signup', next)} className="underline">新規登録</Link>
      </p>
    </main>
  );
}
