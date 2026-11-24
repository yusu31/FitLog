'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { ThickButton } from '@/components/fitlog/thick-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authClient } from '@/lib/auth-client';
import { DELETE_ACCOUNT_MESSAGES as M } from '@/lib/messages';
import { clearCachedUser } from '@/lib/session-cache';

// 退会（F2-b。設定 S-31 の一番下）。元に戻せないので、消えるものを見せて、パスワードを入れてもらってから消す。
// 猶予（あとで戻せる期間）は置かない。パスワードは API 側でも必ず求める（ログイン直後でも省かない）
export function DeleteAccount() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const password = String(new FormData(event.currentTarget).get('password'));
    setPending(true);
    setError(null);
    try {
      const { error: authError } = await authClient.deleteUser({ password });
      if (authError) {
        setError(authError.code === 'INVALID_PASSWORD' ? M.passwordWrong : M.failed);
        return;
      }
      clearCachedUser();
      router.replace('/login');
    } catch {
      setError(M.network);
    } finally {
      setPending(false);
    }
  }

  return (
    <section aria-labelledby="delete-account-heading" className="space-y-3 pt-4">
      <h2 id="delete-account-heading" className="text-note font-bold tracking-widest text-fg-subtle">
        {M.heading}
      </h2>
      {open ? (
        <form onSubmit={onSubmit} className="fl-slab space-y-3 px-4 py-3">
          <p className="text-sm font-bold text-fg [word-break:auto-phrase]">{M.warning}</p>
          <div className="flex flex-col gap-1.5">
            <Label className="font-extrabold" htmlFor="delete-password">
              {M.passwordLabel}
            </Label>
            <Input className="h-12 text-base" id="delete-password" name="password" type="password" autoComplete="current-password" required />
          </div>
          {error && (
            <p role="alert" className="rounded-lg bg-coral-light px-3 py-2 text-sm font-bold text-fg">
              {error}
            </p>
          )}
          <ThickButton type="submit" variant="danger" disabled={pending}>
            {pending ? '退会中…' : M.confirm}
          </ThickButton>
          <ThickButton
            tone="white"
            onClick={() => {
              setOpen(false);
              setError(null);
            }}
          >
            {M.cancel}
          </ThickButton>
        </form>
      ) : (
        <ThickButton variant="link"
          onClick={() => setOpen(true)}
        >
          {M.start}
        </ThickButton>
      )}
    </section>
  );
}
