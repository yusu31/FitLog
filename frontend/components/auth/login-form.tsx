'use client';

import { useRouter } from 'next/navigation';
import { useState, useSyncExternalStore, type FormEvent } from 'react';
import { AuthLayout, AuthLinkButton } from '@/components/auth/auth-layout';
import { LoginHero } from '@/components/auth/login-hero';
import { PasswordField } from '@/components/auth/password-field';
import { ThickButton } from '@/components/fitlog/thick-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authClient } from '@/lib/auth-client';
import { LOGIN_SESSION_FAILED, LOGIN_SESSION_FAILED_HINT, markJustSignedIn, readLoginFailed } from '@/lib/login-failure';
import { withNext } from '@/lib/next-path';
import { useNextParam } from '@/lib/use-next-param';

const subscribeNone = () => () => {};

// S-01 ログイン（docs/screen-design.md）。成功したら ?next= の画面（既定は今日）へ移る。
// 失敗の理由は「メールが無い」「パスワードが違う」を分けずに伝える（登録済みのメールを探られないため）。
export function LoginForm() {
  const router = useRouter();
  const next = useNextParam();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // ログインしたのに、次の画面でセッションが取れず戻されてきた（Cookie が保存されない端末など）
  const sessionFailed = useSyncExternalStore(subscribeNone, readLoginFailed, () => false);

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
      markJustSignedIn();
      router.replace(next);
    } catch {
      setError('通信に失敗しました。電波の良い所でもう一度お試しください');
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthLayout title="ログイン" hero={<LoginHero />}>
      <form onSubmit={onSubmit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <Label className="font-extrabold" htmlFor="email">メールアドレス</Label>
          <Input className="h-12 text-base" id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <PasswordField label="パスワード" autoComplete="current-password" />
        {/* A01-6・D1: 再設定の機能は作らない（要件 4.3）。小さな「忘れたときは？」を開くと、管理者への連絡を案内する */}
        <details className="-mt-2 text-sm text-fg-subtle">
          <summary className="inline-flex min-h-11 cursor-pointer items-center font-bold text-brand underline outline-none focus-visible:ring-4 focus-visible:ring-teal/40">
            忘れたときは？
          </summary>
          <p>パスワードの再設定の機能はありません。グループの管理者に連絡してください</p>
        </details>
        {sessionFailed && !error && (
          <p role="alert" className="rounded-lg bg-coral-light px-3 py-2 text-sm font-bold text-fg">
            {LOGIN_SESSION_FAILED}
            <span className="mt-1 block text-note font-normal text-fg-muted">{LOGIN_SESSION_FAILED_HINT}</span>
          </p>
        )}
        {error && (
          <p role="alert" className="rounded-lg bg-coral-light px-3 py-2 text-sm font-bold text-fg">
            {error}
          </p>
        )}
        <ThickButton type="submit" disabled={pending}>
          {pending ? 'ログイン中…' : 'ログイン'}
        </ThickButton>
      </form>
      {/* A01-2: 新規登録は塗りのボタンとして、ログインの下に並べる */}
      <div className="flex flex-col gap-2">
        <p className="text-center text-sm text-fg-subtle">はじめての方は</p>
        <AuthLinkButton href={withNext('/signup', next)}>新規登録</AuthLinkButton>
      </div>
    </AuthLayout>
  );
}
