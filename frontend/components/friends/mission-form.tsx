'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { ThickButton } from '@/components/fitlog/thick-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { getGetCurrentGroupQueryKey, useUpdateCurrentGroup, type GroupBackground, type GroupDetailResponse } from '@/lib/api/generated';
import { GROUP_MESSAGES, groupErrorMessage } from '@/lib/messages';
import { GROUND_NAMES, GROUND_ORDER } from './friends-text';

export const MISSION_NAME_MAX = 20;
export const MISSION_DESCRIPTION_MAX = 100;

// ミッション（グループの名前・説明・運動場の背景）を直すフォーム（PATCH /groups/current）。メンバー全員が直せる。
// 説明は空にすると消える。送るのは今の値のうち変えたものだけにはせず、3つとも送る（フォームの値がそのまま正本）
export function MissionForm({ group }: { group: GroupDetailResponse }) {
  const queryClient = useQueryClient();
  const update = useUpdateCurrentGroup();
  const [background, setBackground] = useState<GroupBackground>(group.background);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') ?? '').trim();
    const description = String(form.get('description') ?? '').trim();
    setSaved(false);
    if (Array.from(name).length < 1 || Array.from(name).length > MISSION_NAME_MAX) {
      setError(GROUP_MESSAGES.nameLength);
      return;
    }
    if (Array.from(description).length > MISSION_DESCRIPTION_MAX) {
      setError(GROUP_MESSAGES.descriptionLength);
      return;
    }
    setError(null);
    try {
      const res = await update.mutateAsync({ data: { name, description: description === '' ? null : description, background } });
      if (res.status !== 200) {
        setError(groupErrorMessage(res.data, GROUP_MESSAGES.updateFailed, res.status));
        return;
      }
      setSaved(true);
      await queryClient.invalidateQueries({ queryKey: getGetCurrentGroupQueryKey() });
    } catch {
      setError(GROUP_MESSAGES.network);
    }
  }

  return (
    <form onSubmit={onSubmit} className="fl-slab space-y-4 px-4 py-4" aria-label="ミッションを直す">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="mission-name" className="font-extrabold">
          ミッション名
        </Label>
        <Input id="mission-name" name="name" defaultValue={group.name} maxLength={MISSION_NAME_MAX} autoComplete="off" className="h-12 text-base" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="mission-description" className="font-extrabold">
          ミッションの説明
        </Label>
        <Textarea
          id="mission-description"
          name="description"
          defaultValue={group.description ?? ''}
          maxLength={MISSION_DESCRIPTION_MAX}
          placeholder="例: 朝6時に走って、夜は筋トレ"
          aria-describedby="mission-description-hint"
          className="text-base"
        />
        <p id="mission-description-hint" className="text-note text-fg-subtle">
          {MISSION_DESCRIPTION_MAX}字まで。空にすると消えます。招待の画面には出ません
        </p>
      </div>
      <fieldset className="space-y-1.5">
        <legend className="text-sm font-extrabold">運動場の背景</legend>
        <div className="grid grid-cols-2 gap-2">
          {GROUND_ORDER.map((key) => (
            <label key={key} className="relative block cursor-pointer has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-teal/40">
              <input type="radio" name="background" value={key} checked={background === key} onChange={() => setBackground(key)} className="peer sr-only" />
              {/* 飾りの画像。名前は下の文字で読める */}
              <span
                aria-hidden="true"
                className="block aspect-video w-full rounded-fl border-2 border-fg/10 bg-cover bg-bottom [image-rendering:pixelated] peer-checked:border-teal peer-checked:ring-2 peer-checked:ring-teal"
                style={{ backgroundImage: `url(/ground/${key}.png)` }}
              />
              <span className="mt-1 block text-center text-sm font-extrabold">{GROUND_NAMES[key]}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {error && (
        <p role="alert" className="rounded-lg bg-coral-light px-3 py-2 text-sm font-bold text-fg">
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="rounded-lg bg-teal-light px-3 py-2 text-sm font-extrabold text-fg">
          {GROUP_MESSAGES.updateSaved}
        </p>
      )}
      <ThickButton type="submit" disabled={update.isPending} className="w-full">
        {update.isPending ? '保存しています…' : '保存する'}
      </ThickButton>
    </form>
  );
}
