'use client';

import { Check, Copy, Send, X } from 'lucide-react';
import { useState } from 'react';
import { ThickButton } from '@/components/fitlog/thick-button';
import { useCreateInvitation, useRevokeInvitation } from '@/lib/api/generated';
import { GROUP_MESSAGES, groupErrorMessage } from '@/lib/messages';

type Invitation = { id: string; url: string; expiresAt: string };

const formatJst = (iso: string) =>
  new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));

// 招待リンクの値は、作った応答の1回だけ返る（DB にはハッシュだけ。design.md 4章）。
// だから画面を閉じたらもう見られない。必要ならもう一度作る
export function InvitePanel({ full }: { full: boolean }) {
  const createInvitation = useCreateInvitation();
  const revokeInvitation = useRevokeInvitation();
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onCreate() {
    setError(null);
    setNotice(null);
    try {
      const res = await createInvitation.mutateAsync();
      if (res.status !== 201) {
        setError(groupErrorMessage(res.data, GROUP_MESSAGES.invitationFailed, res.status));
        return;
      }
      const url = `${window.location.origin}/invite?token=${encodeURIComponent(res.data.token)}`;
      setInvitation({ id: res.data.id, url, expiresAt: String(res.data.expiresAt) });
      setCopied(false);
    } catch {
      setError(GROUP_MESSAGES.network);
    }
  }

  async function onCopy() {
    if (!invitation) return;
    try {
      await navigator.clipboard.writeText(invitation.url);
      setCopied(true);
    } catch {
      setError(GROUP_MESSAGES.copyFailed);
    }
  }

  async function onRevoke() {
    if (!invitation) return;
    setError(null);
    try {
      const res = await revokeInvitation.mutateAsync({ id: invitation.id });
      if (res.status !== 204) {
        setError(groupErrorMessage(res.data, GROUP_MESSAGES.revokeFailed, res.status));
        return;
      }
      setInvitation(null);
      setNotice('リンクを取り消しました。もう使えません');
    } catch {
      setError(GROUP_MESSAGES.network);
    }
  }

  return (
    <section aria-labelledby="invite-heading" className="pb-4">
      <h2 id="invite-heading" className="flex items-center gap-1.5 pb-2 text-xs font-bold tracking-widest text-sub">
        <Send aria-hidden className="size-4" />
        なかまを まねく
      </h2>

      {full ? (
        <p className="fl-slab px-4 py-3 text-sm font-bold">満員です（5人まで）</p>
      ) : invitation ? (
        <div className="fl-slab space-y-3 border-teal-light bg-teal-light/40 px-4 py-4">
          <div>
            <label htmlFor="invite-url" className="text-sm font-extrabold">
              招待リンク
            </label>
            <p className="text-xs text-sub-strong [word-break:auto-phrase]">
              {formatJst(invitation.expiresAt)} まで使えます（7日間）。
              <br />
              この画面を閉じると、もう表示されません
            </p>
          </div>
          <input
            id="invite-url"
            readOnly
            value={invitation.url}
            onFocus={(e) => e.currentTarget.select()}
            className="h-12 w-full rounded-lg border-2 border-input bg-white px-3 font-mono text-xs text-ink"
          />
          <div className="flex gap-2">
            <ThickButton size="sm" onClick={onCopy} className="flex-1">
              {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
              {copied ? 'コピーしました' : 'コピー'}
            </ThickButton>
            <ThickButton tone="white" size="sm" onClick={onRevoke} disabled={revokeInvitation.isPending}>
              <X aria-hidden />
              取り消す
            </ThickButton>
          </div>
        </div>
      ) : (
        <ThickButton onClick={onCreate} disabled={createInvitation.isPending}>
          <Send aria-hidden />
          {createInvitation.isPending ? '作っています…' : '招待リンクを作る'}
        </ThickButton>
      )}

      <p aria-live="polite" className="mt-2 text-sm font-bold text-teal-dark">
        {notice}
      </p>
      {error && (
        <p role="alert" className="mt-2 rounded-lg bg-coral-light px-3 py-2 text-sm font-bold text-ink">
          {error}
        </p>
      )}
    </section>
  );
}
