'use client';

import { Check, Copy, Send, Share2, X } from 'lucide-react';
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

// LINE の共有画面を開く URL（Web Share API が無い端末の代わり。A09-1）
const lineShareUrl = (url: string) => `https://line.me/R/share?text=${encodeURIComponent(`FitLog で一緒に記録しよう ${url}`)}`;

// 招待リンクの値は、作った応答の1回だけ返る（DB にはハッシュだけ。design.md 4章）。
// だから画面を閉じたら同じリンクは見られない。必要なら、いつでも新しいリンクを作れる
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

  // 共有（LINE などへ直接送る）。Web Share API がある端末だけ。自分で閉じた（AbortError）ときは何も出さない
  async function onShare() {
    if (!invitation) return;
    try {
      await navigator.share({ title: 'FitLog の招待', text: 'FitLog で一緒に記録しよう', url: invitation.url });
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      setError(GROUP_MESSAGES.shareFailed);
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
              閉じても、いつでも新しいリンクを作れます
            </p>
          </div>
          <input
            id="invite-url"
            readOnly
            value={invitation.url}
            onFocus={(e) => e.currentTarget.select()}
            className="h-12 w-full rounded-lg border-2 border-input bg-white px-3 font-mono text-xs text-ink"
          />
          {/* 送る（共有）を主にする。共有できない端末は LINE の共有 URL（A09-1） */}
          {typeof navigator.share === 'function' ? (
            <ThickButton onClick={onShare}>
              <Share2 aria-hidden />
              共有
            </ThickButton>
          ) : (
            <a
              href={lineShareUrl(invitation.url)}
              target="_blank"
              rel="noopener noreferrer"
              className="fl-thick inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-fl bg-teal-dark text-lg font-extrabold tracking-wider text-white outline-none [--thick:var(--color-teal-deep)] focus-visible:ring-4 focus-visible:ring-teal/40 [&_svg]:size-5"
            >
              <Send aria-hidden />
              LINEで送る
            </a>
          )}
          <div className="flex gap-2">
            <ThickButton tone="white" size="sm" onClick={onCopy} className="flex-1">
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
