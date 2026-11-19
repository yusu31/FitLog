'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { ProfileForm } from '@/components/body/profile-form';
import { ThickButton } from '@/components/fitlog/thick-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getGetBodyQueryKey, useGetBody, useGetMyProfile, useSetHeight } from '@/lib/api/generated';
import { messageOf } from '@/lib/api/message';
import { BODY_CONNECT_MESSAGES as M, BODY_MESSAGES, parseHeightText } from '@/lib/body/body';

// 設定の身長とプロフィール3欄（B14b）。血液型・MBTI・基礎代謝の欄は作らない（3章の判断）。
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
      <p className="text-note text-sub-strong">{M.settingsNote}</p>
      {data && <HeightForm heightCm={data.heightCm} />}
      {mine && <ProfileForm initial={mine} />}
    </section>
  );
}

function HeightForm({ heightCm }: { heightCm: number | null }) {
  const queryClient = useQueryClient();
  const setHeight = useSetHeight();
  const [text, setText] = useState(heightCm === null ? '' : String(heightCm));
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    const height = text.trim() === '' ? null : parseHeightText(text);
    if (text.trim() !== '' && height === null) return setNotice({ ok: false, text: BODY_MESSAGES.heightInvalid });
    try {
      const res = await setHeight.mutateAsync({ data: { heightCm: height } });
      if (res.status !== 200) return setNotice({ ok: false, text: messageOf(res.data, BODY_MESSAGES.saveFailed) });
      await queryClient.invalidateQueries({ queryKey: getGetBodyQueryKey() });
      setNotice({ ok: true, text: BODY_MESSAGES.saved });
    } catch {
      setNotice({ ok: false, text: BODY_MESSAGES.saveFailed });
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <Label htmlFor="settings-height" className="font-extrabold">
        {BODY_MESSAGES.heightLabel}
      </Label>
      <Input id="settings-height" inputMode="decimal" value={text} onChange={(e) => setText(e.target.value)} className="h-11 bg-white" />
      <p className="text-note text-sub-strong">{BODY_MESSAGES.heightHint}</p>
      <ThickButton type="submit" size="sm" className="w-full" disabled={setHeight.isPending}>
        {setHeight.isPending ? BODY_MESSAGES.saving : M.heightSave}
      </ThickButton>
      {notice && (
        <p role={notice.ok ? 'status' : 'alert'} className="text-sm font-bold text-ink">
          {notice.text}
        </p>
      )}
    </form>
  );
}
