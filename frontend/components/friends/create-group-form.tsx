'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { ThickButton } from '@/components/fitlog/thick-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getGetCurrentGroupQueryKey, useCreateGroup } from '@/lib/api/generated';
import { GROUP_MESSAGES, groupErrorMessage } from '@/lib/messages';

export const GROUP_NAME_MAX = 20;

// グループを作るフォーム（POST /groups）。仲間タブ（S-20）の案内と、グループの設定（S-32）で同じものを使う。
// 作れたらグループの問い合わせをやり直すので、画面は自然に「グループがある」表示へ変わる。
// onCancel を渡したときだけ「やめる」を出す
export function CreateGroupForm({ onCancel, onCreated }: { onCancel?: () => void; onCreated?: () => void }) {
  const queryClient = useQueryClient();
  const createGroup = useCreateGroup();
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = String(new FormData(event.currentTarget).get('name') ?? '').trim();
    // 1〜20字（見た目の1文字を1と数える。API と同じ数え方。T-NAME-01）
    const length = Array.from(name).length;
    if (length < 1 || length > GROUP_NAME_MAX) {
      setError(GROUP_MESSAGES.nameLength);
      return;
    }
    setError(null);
    try {
      const res = await createGroup.mutateAsync({ data: { name } });
      if (res.status !== 201) {
        setError(groupErrorMessage(res.data, GROUP_MESSAGES.createFailed, res.status));
        return;
      }
      onCreated?.();
      await queryClient.invalidateQueries({ queryKey: getGetCurrentGroupQueryKey() });
    } catch {
      setError(GROUP_MESSAGES.network);
    }
  }

  return (
    <form onSubmit={onSubmit} className="fl-slab space-y-3 px-4 py-4" aria-label="グループを作る">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="group-name" className="font-extrabold">
          グループ名
        </Label>
        <Input
          id="group-name"
          name="name"
          maxLength={GROUP_NAME_MAX}
          autoComplete="off"
          placeholder="例: 朝トレ部"
          aria-describedby="group-name-hint"
          aria-invalid={error ? true : undefined}
          className="h-12 text-base"
        />
        <p id="group-name-hint" className="text-xs text-sub">
          1〜{GROUP_NAME_MAX}字。あとから仲間に見えます
        </p>
      </div>
      {error && (
        <p role="alert" className="rounded-lg bg-coral-light px-3 py-2 text-sm font-bold text-ink">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <ThickButton type="submit" disabled={createGroup.isPending} className="flex-1">
          {createGroup.isPending ? '作っています…' : '作る'}
        </ThickButton>
        {onCancel && (
          <ThickButton tone="white" size="sm" onClick={onCancel} className="min-h-14">
            やめる
          </ThickButton>
        )}
      </div>
    </form>
  );
}
