'use client';

import { Link2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ThickButton } from '@/components/fitlog/thick-button';
import { extractInviteToken } from '@/lib/invite-token';
import { GROUP_MESSAGES } from '@/lib/messages';

// 使えないリンクを開いたときに、届き直したリンクをその場で貼れる欄（A13-8）。
// 仲間タブへ戻って貼り直さなくてよいように、同じ画面に置く。ログインの有無に関係なく出す
export function PasteInvite() {
  const router = useRouter();
  const [pasted, setPasted] = useState('');
  const [error, setError] = useState<string | null>(null);

  function onOpen() {
    const token = extractInviteToken(pasted);
    if (!token) {
      setError(GROUP_MESSAGES.pasteInvalid);
      return;
    }
    router.push(`/invite?token=${encodeURIComponent(token)}`);
  }

  return (
    <section className="space-y-2">
      <label htmlFor="paste-invite" className="text-sm font-extrabold">
        届いた招待リンク
      </label>
      <p className="text-xs text-sub-strong">新しいリンクが届いたら、ここに貼ってください。</p>
      <input
        id="paste-invite"
        value={pasted}
        onChange={(e) => {
          setPasted(e.target.value);
          setError(null);
        }}
        placeholder="https://…/invite?token=…"
        autoComplete="off"
        className="h-12 w-full rounded-lg border-2 border-input bg-white px-3 font-mono text-xs text-ink"
      />
      <ThickButton tone="white" size="sm" onClick={onOpen}>
        <Link2 aria-hidden />
        開く
      </ThickButton>
      {error && (
        <p role="alert" className="rounded-lg bg-coral-light px-3 py-2 text-sm font-bold text-ink">
          {error}
        </p>
      )}
    </section>
  );
}
