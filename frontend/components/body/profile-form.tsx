'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { ThickButton } from '@/components/fitlog/thick-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getGetMyProfileQueryKey, useSetMyProfile, type ProfileResponse } from '@/lib/api/generated';
import { messageOf } from '@/lib/api/message';
import { BIO_MAX, BODY_MESSAGES } from '@/lib/body/body';

// プロフィール＝ひとことだけ（仲間のメンバー一覧に出る・任意）。よくやる運動・動きやすい時間帯は、どこにも使っていなかったので 2026-11-23 に画面から外した（API と DB の列は残す）
export function ProfileForm({ initial }: { initial: ProfileResponse }) {
  const queryClient = useQueryClient();
  const save = useSetMyProfile();
  const [bio, setBio] = useState(initial.bio ?? '');
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    try {
      const res = await save.mutateAsync({ data: { bio: bio.trim() === '' ? null : bio.trim() } });
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
        <Input id="profile-bio" value={bio} maxLength={BIO_MAX} onChange={(e) => setBio(e.target.value)} className="h-11 bg-surface" />
        <p className="text-note text-fg-muted">{BODY_MESSAGES.bioHint}</p>
      </div>
      <ThickButton type="submit" size="sm" className="w-full" disabled={save.isPending}>
        {save.isPending ? BODY_MESSAGES.saving : BODY_MESSAGES.save}
      </ThickButton>
      {notice && (
        <p role={notice.ok ? 'status' : 'alert'} className="text-sm font-bold text-fg">
          {notice.text}
        </p>
      )}
    </form>
  );
}
