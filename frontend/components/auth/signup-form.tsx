'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authClient } from '@/lib/auth-client';
import { safeNextPath, withNext } from '@/lib/next-path';

// better-auth の既定: パスワードは8文字以上（API 側でも検査される。ここは入力中に気づかせるため）
const MIN_PASSWORD_LENGTH = 8;

// S-02 新規登録（docs/screen-design.md）。登録するとそのままログイン済みになり、?next= の画面へ移る。
export function SignupForm() {
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
      const { error: authError } = await authClient.signUp.email({
        name: String(form.get('name')),
        email: String(form.get('email')),
        password: String(form.get('password')),
      });
      if (authError) {
        setError(messageFor(authError.code));
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
      <h1 className="text-2xl font-bold">新規登録</h1>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">表示名</Label>
          <Input id="name" name="name" autoComplete="nickname" required maxLength={30} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">メールアドレス</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">パスワード（{MIN_PASSWORD_LENGTH}文字以上）</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={MIN_PASSWORD_LENGTH}
          />
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" disabled={pending}>
          {pending ? '登録中…' : '登録する'}
        </Button>
      </form>
      <p className="text-sm text-muted-foreground">
        登録済みの方は <Link href={withNext('/login', next)} className="underline">ログイン</Link>
      </p>
    </main>
  );
}

// better-auth のエラーコード（英語）を、利用者に見せる日本語にする。知らないコードは汎用の文にする
function messageFor(code: string | undefined): string {
  switch (code) {
    case 'USER_ALREADY_EXISTS':
    case 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL':
      return 'このメールアドレスは登録済みです。ログインをお試しください';
    case 'PASSWORD_TOO_SHORT':
      return `パスワードは${MIN_PASSWORD_LENGTH}文字以上にしてください`;
    case 'INVALID_EMAIL':
      return 'メールアドレスの形が正しくありません';
    default:
      return '登録できませんでした。入力を確かめて、もう一度お試しください';
  }
}
