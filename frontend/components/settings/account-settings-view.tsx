'use client';

import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { FullScreen } from '@/components/fitlog/full-screen';
import { ThickButton } from '@/components/fitlog/thick-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authClient } from '@/lib/auth-client';
import { ACCOUNT_MESSAGES } from '@/lib/messages';
import { BodySettings } from './body-settings';
import { useAppSession } from '@/lib/use-app-session';
import { useRequireSession } from '@/lib/use-require-session';

// 登録時と同じ境界（API 側でも守る。ここは入力中に気づかせるため）
const MAX_NAME_LENGTH = 30;
const MIN_PASSWORD_LENGTH = 8;

type Notice = { kind: 'ok' | 'error'; text: string } | null;

// アカウントの設定（F2-a。設定 S-31 から開く）。表示名とパスワードを変える。
// 変更は better-auth の標準の窓口（updateUser・changePassword）を使い、自前の API は作らない
export function AccountSettingsView() {
  const { signedIn } = useRequireSession();
  const { data: session } = useAppSession();
  const user = session?.user;

  return (
    <FullScreen>
      <header className="flex items-center gap-1 px-2 pt-3">
        <Link
          href="/settings"
          aria-label="設定へ戻る"
          className="flex size-11 items-center justify-center rounded-fl text-fg-muted outline-none focus-visible:ring-4 focus-visible:ring-teal/40"
        >
          <ChevronLeft aria-hidden className="size-7" />
        </Link>
        <h1 className="text-page-title font-extrabold">アカウントの設定</h1>
      </header>

      {signedIn && user && (
        <div className="space-y-5 px-4 pt-3 pb-10">
          <NameForm initialName={user.name} />
          <BodySettings />
          <PasswordForm />
        </div>
      )}
    </FullScreen>
  );
}

function NoticeText({ notice }: { notice: Notice }) {
  if (!notice) return null;
  return notice.kind === 'ok' ? (
    <p role="status" className="rounded-lg bg-teal-light px-3 py-2 text-sm font-extrabold text-fg">
      {notice.text}
    </p>
  ) : (
    <p role="alert" className="rounded-lg bg-coral-light px-3 py-2 text-sm font-bold text-fg">
      {notice.text}
    </p>
  );
}

function NameForm({ initialName }: { initialName: string }) {
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

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
    <section aria-labelledby="name-heading" className="fl-slab space-y-3 px-4 py-3">
      <h2 id="name-heading" className="font-extrabold">
        名前の変更
      </h2>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label className="font-extrabold" htmlFor="account-name">
            表示名
          </Label>
          <Input
            className="h-12 text-base"
            id="account-name"
            name="name"
            autoComplete="nickname"
            required
            maxLength={MAX_NAME_LENGTH}
            defaultValue={initialName}
          />
        </div>
        <NoticeText notice={notice} />
        <ThickButton type="submit" disabled={pending}>
          {pending ? '保存中…' : '名前を保存する'}
        </ThickButton>
      </form>
    </section>
  );
}

function PasswordForm() {
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setPending(true);
    setNotice(null);
    try {
      const { error } = await authClient.changePassword({
        currentPassword: String(form.get('currentPassword')),
        newPassword: String(form.get('newPassword')),
        // 変更したら、ほかの端末のログインは外す（落としたスマホなどに残さない）
        revokeOtherSessions: true,
      });
      if (error) {
        setNotice({ kind: 'error', text: messageFor(error.code) });
        return;
      }
      formElement.reset();
      setNotice({ kind: 'ok', text: ACCOUNT_MESSAGES.passwordChanged });
    } catch {
      setNotice({ kind: 'error', text: ACCOUNT_MESSAGES.network });
    } finally {
      setPending(false);
    }
  }

  return (
    <section aria-labelledby="password-heading" className="fl-slab space-y-3 px-4 py-3">
      <h2 id="password-heading" className="font-extrabold">
        パスワードの変更
      </h2>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label className="font-extrabold" htmlFor="current-password">
            今のパスワード
          </Label>
          <Input className="h-12 text-base" id="current-password" name="currentPassword" type="password" autoComplete="current-password" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="font-extrabold" htmlFor="new-password">
            新しいパスワード（{MIN_PASSWORD_LENGTH}文字以上）
          </Label>
          <Input
            className="h-12 text-base"
            id="new-password"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={MIN_PASSWORD_LENGTH}
          />
        </div>
        <NoticeText notice={notice} />
        <ThickButton type="submit" disabled={pending}>
          {pending ? '変更中…' : 'パスワードを変更する'}
        </ThickButton>
      </form>
    </section>
  );
}

// better-auth のエラーコード（英語）→ 日本語。知らないコードは汎用の文にする
function messageFor(code: string | undefined): string {
  switch (code) {
    case 'INVALID_PASSWORD':
      return ACCOUNT_MESSAGES.passwordWrong;
    case 'PASSWORD_TOO_SHORT':
      return ACCOUNT_MESSAGES.passwordShort;
    default:
      return ACCOUNT_MESSAGES.passwordFailed;
  }
}
