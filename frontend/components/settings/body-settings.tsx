'use client';

import { buttonClass } from '@/components/fitlog/thick-button';
import Link from 'next/link';
import { ProfileForm } from '@/components/body/profile-form';
import { useGetBody, useGetMyProfile } from '@/lib/api/generated';
import { BODY_CONNECT_MESSAGES as M, BODY_MESSAGES } from '@/lib/body/body';

// 設定の身長（表示と「からだ」へのリンクだけ。入力は「からだ」の画面）とプロフィールのひとこと（B14b）。血液型・MBTI・基礎代謝の欄は作らない（3章の判断）。
// 読み込めないときは何も出さない（名前・パスワードの変更を邪魔しない）
export function BodySettings() {
  const body = useGetBody();
  const profile = useGetMyProfile();
  const data = body.data?.status === 200 ? body.data.data : null;
  const mine = profile.data?.status === 200 ? profile.data.data : null;
  if (!data && !mine) return null;

  return (
    <section aria-labelledby="body-settings-heading" className="fl-slab space-y-4 px-4 py-3">
      <h2 id="body-settings-heading" className="font-extrabold">
        {M.settingsTitle}
      </h2>
      <p className="text-note text-fg-muted">{M.settingsNote}</p>
      {data && (
        <div className="space-y-1">
          <p className="font-extrabold">{BODY_MESSAGES.heightLabel}</p>
          <p className="fl-num text-lg">{data.heightCm === null ? '未入力' : `${data.heightCm}cm`}</p>
          {/* 身長の入力は「からだ」の画面だけ（体重と並べて入れる） */}
          <Link href="/me/body" className={buttonClass({ variant: 'link' })}>
            {M.heightLink}
          </Link>
        </div>
      )}
      {mine && <ProfileForm initial={mine} />}
    </section>
  );
}
