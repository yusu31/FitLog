'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { ThickButton } from '@/components/fitlog/thick-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getGetMyProfileQueryKey, useSetMyProfile, type ProfileResponse } from '@/lib/api/generated';
import { messageOf } from '@/lib/api/message';
import { ACTIVE_OPTIONS, BIO_MAX, BODY_MESSAGES, FAVORITE_OPTIONS } from '@/lib/body/body';

type Choice<T extends string> = { value: T; label: string };

function RadioRow<T extends string>({ legend, name, options, value, onChange }: { legend: string; name: string; options: readonly Choice<T>[]; value: T | null; onChange: (v: T | null) => void }) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-extrabold">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <label key={o.value} className="flex min-h-11 items-center gap-2 rounded-fl border-2 border-teal-light px-3 text-sm font-bold has-[:checked]:border-teal-dark has-[:checked]:bg-teal-light">
            <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} className="size-4" />
            {o.label}
          </label>
        ))}
        <label className="flex min-h-11 items-center gap-2 rounded-fl border-2 border-line px-3 text-sm font-bold text-sub-strong has-[:checked]:border-teal-dark">
          <input type="radio" name={name} value="" checked={value === null} onChange={() => onChange(null)} className="size-4" />
          {BODY_MESSAGES.none}
        </label>
      </div>
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
      <RadioRow legend={BODY_MESSAGES.favoriteLegend} name="favorite" options={FAVORITE_OPTIONS} value={favorite} onChange={setFavorite} />
      <RadioRow legend={BODY_MESSAGES.activeLegend} name="active" options={ACTIVE_OPTIONS} value={active} onChange={setActive} />
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
