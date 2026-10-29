'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { AuthLayout } from '@/components/auth/auth-layout';
import { ThickButton } from '@/components/fitlog/thick-button';
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
    <AuthLayout title="ログイン">
      <form onSubmit={onSubmit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <Label className="font-extrabold" htmlFor="email">メールアドレス</Label>
          <Input className="h-12 text-base" id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="font-extrabold" htmlFor="password">パスワード</Label>
          <Input className="h-12 text-base" id="password" name="password" type="password" autoComplete="current-password" required />
        </div>
        {error && (
          <p role="alert" className="rounded-lg bg-coral-light px-3 py-2 text-sm font-bold text-ink">
            {error}
          </p>
        )}
        <ThickButton type="submit" disabled={pending}>
          {pending ? 'ログイン中…' : 'ログイン'}
        </ThickButton>
      </form>
      <p className="text-center text-sm text-sub">
        はじめての方は <Link href={withNext('/signup', next)} className="font-extrabold text-teal-dark underline underline-offset-4">新規登録</Link>
      </p>
    </AuthLayout>
  );
}
