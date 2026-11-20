'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { ThickButton } from '@/components/fitlog/thick-button';
import { Segmented } from '@/components/ui/segmented';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getGetMyProfileQueryKey, useSetMyProfile, type ProfileResponse } from '@/lib/api/generated';
import { messageOf } from '@/lib/api/message';
import { ACTIVE_OPTIONS, BIO_MAX, BODY_MESSAGES, FAVORITE_OPTIONS } from '@/lib/body/body';

type Choice<T extends string> = { value: T; label: string };

function RadioRow<T extends string>({ legend, options, value, onChange }: { legend: string; options: readonly Choice<T>[]; value: T | null; onChange: (v: T | null) => void }) {
  // 「答えない」は、選んでいる値をもう一度押すと外れる形ではなく、専用の選択肢として並べる
  const all = [...options, { value: '', label: BODY_MESSAGES.none }] as const;
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-extrabold">{legend}</legend>
      <Segmented legend={legend} options={all as unknown as readonly Choice<string>[]} value={value ?? ''} onChange={(v) => onChange(v === '' ? null : (v as T))} />
    </fieldset>
  );
}

// プロフィール（仲間に見える・すべて任意）。保存は置き換え（送らなかった欄は空になる）
export function ProfileForm({ initial }: { initial: ProfileResponse }) {
  const queryClient = useQueryClient();
  const save = useSetMyProfile();
  const [bio, setBio] = useState(initial.bio ?? '');
  const [favorite, setFavorite] = useState(initial.favoriteKind);
  const [active, setActive] = useState(initial.activeTime);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    try {
      const res = await save.mutateAsync({ data: { bio: bio.trim() === '' ? null : bio.trim(), favoriteKind: favorite, activeTime: active } });
      if (res.status === 200) {
        await queryClient.invalidateQueries({ queryKey: getGetMyProfileQueryKey() });
        setNotice({ ok: true, text: BODY_MESSAGES.saved });
      } else {
        setNotice({ ok: false, text: messageOf(res.data, BODY_MESSAGES.saveFailed) });
      }
    } catch {
      setNotice({ ok: false, text: BODY_MESSAGES.saveFailed });
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="profile-bio" className="font-extrabold">
          {BODY_MESSAGES.bioLabel}
        </Label>
        <Input id="profile-bio" value={bio} maxLength={BIO_MAX} onChange={(e) => setBio(e.target.value)} className="h-11 bg-white" />
        <p className="text-note text-sub-strong">{BODY_MESSAGES.bioHint}</p>
      </div>
      <RadioRow legend={BODY_MESSAGES.favoriteLegend} options={FAVORITE_OPTIONS} value={favorite} onChange={setFavorite} />
      <RadioRow legend={BODY_MESSAGES.activeLegend} options={ACTIVE_OPTIONS} value={active} onChange={setActive} />
      <ThickButton type="submit" size="sm" className="w-full" disabled={save.isPending}>
        {save.isPending ? BODY_MESSAGES.saving : BODY_MESSAGES.save}
      </ThickButton>
      {notice && (
        <p role={notice.ok ? 'status' : 'alert'} className="text-sm font-bold text-ink">
          {notice.text}
        </p>
      )}
    </form>
  );
}
