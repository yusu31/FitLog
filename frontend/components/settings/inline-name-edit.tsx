'use client';

import { useState, type FormEvent } from 'react';
import { ThickButton } from '@/components/fitlog/thick-button';
import { authClient } from '@/lib/auth-client';
import { ACCOUNT_MESSAGES } from '@/lib/messages';

const MAX_NAME_LENGTH = 30;

// 設定の上部で、表示名をその場で直す（A10-4）。アカウントの設定を開かなくてよい。
// 保存は better-auth の updateUser（アカウントの設定と同じ窓口）。メールは直せないので文字だけ
export function InlineNameEdit({ initialName, email }: { initialName: string; email?: string }) {
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = String(new FormData(event.currentTarget).get('name')).trim();
    setNotice(null);
    if (name.length < 1 || name.length > MAX_NAME_LENGTH) {
      setNotice({ kind: 'error', text: ACCOUNT_MESSAGES.nameEmpty });
      return;
    }
    setPending(true);
    try {
      const { error } = await authClient.updateUser({ name });
      setNotice(error ? { kind: 'error', text: ACCOUNT_MESSAGES.nameFailed } : { kind: 'ok', text: ACCOUNT_MESSAGES.nameSaved });
    } catch {
      setNotice({ kind: 'error', text: ACCOUNT_MESSAGES.network });
    } finally {
      setPending(false);
    }
  }

  return (
    <section aria-label="ユーザー情報" className="fl-slab space-y-2 px-4 py-3">
      <form onSubmit={onSubmit} className="flex items-end gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <label htmlFor="inline-name" className="text-note font-bold text-sub-strong">
            表示名
          </label>
          <input
            id="inline-name"
            name="name"
            autoComplete="nickname"
            required
            maxLength={MAX_NAME_LENGTH}
            defaultValue={initialName}
            className="h-12 w-full rounded-lg border-2 border-input bg-white px-3 text-base font-extrabold text-ink"
          />
        </div>
        <ThickButton type="submit" size="sm" className="h-12" disabled={pending}>
          {pending ? '保存中…' : '名前を保存'}
        </ThickButton>
      </form>
      {email && <p className="truncate text-sm text-sub-strong">{email}</p>}
      {notice &&
        (notice.kind === 'ok' ? (
          <p role="status" className="rounded-lg bg-teal-light px-3 py-2 text-sm font-extrabold text-ink">
            {notice.text}
          </p>
        ) : (
          <p role="alert" className="rounded-lg bg-coral-light px-3 py-2 text-sm font-bold text-ink">
            {notice.text}
          </p>
        ))}
    </section>
  );
}
