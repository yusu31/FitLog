'use client';

import { Link2, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { MyChara } from '@/components/fitlog/my-chara';
import { ThickButton } from '@/components/fitlog/thick-button';
import { extractInviteToken } from '@/lib/invite-token';
import { GROUP_MESSAGES } from '@/lib/messages';
import { CreateGroupForm } from './create-group-form';
import { GROUP_MEMBER_MAX } from './member-list';

// グループに入っていない人への案内（docs/screen-design.md 4章・5章）。
// 「グループを作る」と「招待リンクで参加する」の2つだけ。グループを作る入口は、仲間タブのここと S-32（グループの設定）の2か所。
// 順位・連続日数は出さない
export function NoGroupGuide() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pasted, setPasted] = useState('');
  const [pasteError, setPasteError] = useState<string | null>(null);

  // 貼られたリンク（URL 全体か token だけ）から token を取り出して、参加の画面へ（N8）
  function onOpenInvite() {
    const token = extractInviteToken(pasted);
    if (!token) {
      setPasteError(GROUP_MESSAGES.pasteInvalid);
      return;
    }
    router.push(`/invite?token=${encodeURIComponent(token)}`);
  }
  return (
    <div className="space-y-4 px-4 pt-3">
      {/* 自分1人のとき（friends-view の alone）と同じ形: キャラ＋1行＋次の一手。大きな色のカードは置かない（D7-4） */}
      <section className="flex flex-col items-center gap-1 pt-2 text-center">
        <MyChara pose="welcome" size={96} />
        <h2 className="text-base font-extrabold">仲間と、見せ合おう（{GROUP_MEMBER_MAX}人まで）</h2>
        {!open && (
          <ThickButton className="mt-2" onClick={() => setOpen(true)}>
            <Plus aria-hidden />
            グループを作る
          </ThickButton>
        )}
      </section>

      {open && <CreateGroupForm onCancel={() => setOpen(false)} />}

      <section className="fl-slab space-y-3 px-4 py-3">
        <div className="flex gap-3">
          <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full bg-teal-light text-brand">
            <Link2 aria-hidden className="size-5" />
          </span>
          <div>
            <h2 className="font-extrabold">招待リンクで参加する</h2>
            <p className="mt-0.5 text-sm text-fg-subtle">
              仲間から届いたリンクを開くか、下の欄に貼ってください。参加の画面が開きます。
            </p>
          </div>
        </div>
        <div>
          <label htmlFor="paste-invite" className="text-sm font-extrabold">
            届いた招待リンク
          </label>
          <input
            id="paste-invite"
            value={pasted}
            onChange={(e) => {
              setPasted(e.target.value);
              setPasteError(null);
            }}
            placeholder="https://…/invite?token=…"
            autoComplete="off"
            className="mt-1 h-12 w-full rounded-lg border-2 border-input bg-surface px-3 font-mono text-note text-fg"
          />
        </div>
        <ThickButton tone="white" size="sm" onClick={onOpenInvite}>
          <Link2 aria-hidden />
          開く
        </ThickButton>
        {pasteError && (
          <p role="alert" className="rounded-lg bg-coral-light px-3 py-2 text-sm font-bold text-fg">
            {pasteError}
          </p>
        )}
      </section>
    </div>
  );
}
