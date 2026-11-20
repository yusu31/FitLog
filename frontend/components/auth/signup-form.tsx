'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { AuthLayout, AuthLinkButton } from '@/components/auth/auth-layout';
import { PasswordField } from '@/components/auth/password-field';
import { ThickButton } from '@/components/fitlog/thick-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authClient } from '@/lib/auth-client';
import { withNext } from '@/lib/next-path';
import { useNextParam } from '@/lib/use-next-param';

// better-auth の既定: パスワードは8文字以上（API 側でも検査される。ここは入力中に気づかせるため）
const MIN_PASSWORD_LENGTH = 8;
// 「登録できたよ」を見せておく時間（ミリ秒）
const DONE_MESSAGE_MS = 1200;

// S-02 新規登録（docs/screen-design.md）。登録するとそのままログイン済みになり、?next= の画面へ移る。
export function SignupForm() {
  const router = useRouter();
  const next = useNextParam();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    // A13-7: ブラウザ標準の吹き出しは見落としやすいので、自前で検査して画面にエラー文を出す
    const invalid = validate(String(form.get('name')), String(form.get('email')), String(form.get('password')));
    if (invalid) {
      setError(invalid);
      return;
    }
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
      // A01-7: 登録できたことを一言見せてから、少し待って移る（いきなり画面が変わらないように）
      setDone(true);
      setTimeout(() => router.replace(next), DONE_MESSAGE_MS);
    } catch {
      setError('通信に失敗しました。電波の良い所でもう一度お試しください');
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthLayout title="新規登録">
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <Label className="font-extrabold" htmlFor="name">表示名</Label>
          <Input className="h-12 text-base" id="name" name="name" autoComplete="nickname" required maxLength={30} aria-describedby="name-hint" />
          <p id="name-hint" className="text-sm text-fg-subtle">仲間に見える名前です。あとから変えられます</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="font-extrabold" htmlFor="email">メールアドレス</Label>
          <Input className="h-12 text-base" id="email" name="email" type="email" autoComplete="email" required aria-describedby="email-hint" />
          <p id="email-hint" className="text-sm text-fg-subtle">ログインに使います</p>
        </div>
        <PasswordField label={`パスワード（${MIN_PASSWORD_LENGTH}文字以上）`} autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} />
        {error && (
          <p role="alert" className="rounded-lg bg-coral-light px-3 py-2 text-sm font-bold text-fg">
            {error}
          </p>
        )}
        {done && (
          <p role="status" className="rounded-lg bg-teal-light px-3 py-2 text-sm font-bold text-fg">
            登録できたよ。今日の画面へ移ります
          </p>
        )}
        <ThickButton type="submit" disabled={pending || done}>
          {pending ? '登録中…' : '登録する'}
        </ThickButton>
      </form>
      <div className="flex flex-col gap-2">
        <p className="text-center text-sm text-fg-subtle">登録済みの方は</p>
        <AuthLinkButton href={withNext('/login', next)}>ログイン</AuthLinkButton>
      </div>
    </AuthLayout>
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

// 送る前の入力検査。問題があれば日本語の文を返す（API 側の検査と同じ基準）
function validate(name: string, email: string, password: string): string | null {
  if (name.trim() === '') return '表示名を入力してください';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'メールアドレスの形が正しくありません';
  if (password.length < MIN_PASSWORD_LENGTH) return `パスワードは${MIN_PASSWORD_LENGTH}文字以上にしてください`;
  return null;
}
