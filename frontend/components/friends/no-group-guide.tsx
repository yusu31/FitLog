'use client';

import { Link2, Plus } from 'lucide-react';
import { useState } from 'react';
import { ThickButton } from '@/components/fitlog/thick-button';
import { CreateGroupForm } from './create-group-form';
import { GROUP_MEMBER_MAX } from './member-list';

// グループに入っていない人への案内（docs/screen-design.md 4章・5章）。
// 「グループを作る」と「招待リンクで参加する」の2つだけ。グループを作る入口は、仲間タブのここと S-32（グループの設定）の2か所。
// 順位・連続日数は出さない
export function NoGroupGuide() {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-4 px-4 pt-3">
      <section className="fl-stripes relative overflow-hidden rounded-fl bg-teal-dark [--stripe:rgb(0_0_0/0.14)] px-[18px] pt-3.5 pb-4 text-white shadow-[0_4px_0_var(--color-teal-deep)]">
        <span className="fl-tag bg-gold text-ink">TEAM</span>
        <h2 className="mt-3 text-2xl leading-snug font-extrabold">仲間と、見せ合おう</h2>
        <p className="mt-1 text-sm leading-relaxed font-bold [word-break:auto-phrase]">
          グループは1つ・<span className="fl-num text-base">{GROUP_MEMBER_MAX}</span>人まで。記録した日やスタンプを、仲間どうしで見せ合えます。
        </p>
        {!open && (
          <ThickButton tone="gold" className="mt-4" onClick={() => setOpen(true)}>
            <Plus aria-hidden />
            グループを作る
          </ThickButton>
        )}
      </section>

      {open && <CreateGroupForm onCancel={() => setOpen(false)} />}

      <section className="fl-slab flex gap-3 px-4 py-3">
        <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full bg-teal-light text-teal-dark">
          <Link2 aria-hidden className="size-5" />
        </span>
        <div>
          <h2 className="font-extrabold">招待リンクで参加する</h2>
          <p className="mt-0.5 text-sm text-sub">仲間から届いたリンクを開くと、参加の画面が開きます。</p>
        </div>
      </section>
    </div>
  );
}
