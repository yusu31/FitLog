'use client';

import Link from 'next/link';
import { Avatar } from '@/components/fitlog/avatar';
import { buttonClass } from '@/components/fitlog/thick-button';
import { useGetMyAvatar } from '@/lib/api/generated';
import { CHARA_MESSAGES } from '@/lib/chara-messages';
import { useAppSession } from '@/lib/use-app-session';
import { BodySummary } from './body-summary';

// 自分 > プロフィール（02-9 ⑫）: 名前・キャラ・からだ。キャラを変える（/me/chara）とからだ（/me/body）の入口
export function ProfileView() {
  const { data: session } = useAppSession();
  const avatar = useGetMyAvatar();
  return (
    <>
      <section className="fl-slab flex items-center gap-3 px-4 py-3">
        {/* 顔の丸も「キャラを変える」へ（同じ行き先なので読み上げ・Tab からは外す） */}
        <Link href="/me/chara" aria-hidden="true" tabIndex={-1} className="shrink-0 rounded-full outline-none">
          <Avatar avatar={avatar.data?.status === 200 ? avatar.data.data : null} size={48} />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-extrabold">{session?.user.name}</p>
          <Link href="/me/chara" className={buttonClass({ variant: 'link' }, 'px-0')}>
            {CHARA_MESSAGES.entry}
          </Link>
        </div>
      </section>
      <BodySummary />
    </>
  );
}
