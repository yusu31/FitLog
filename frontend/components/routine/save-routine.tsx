'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Bookmark } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { ThickButton } from '@/components/fitlog/thick-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getListRoutinesQueryKey, useCreateRoutine } from '@/lib/api/generated';
import { messageOf } from '@/lib/api/message';
import { ROUTINE_MESSAGES } from '@/lib/messages';
import { useOnline } from '@/lib/use-browser-state';

// API の上限（routines_name_ck・ROUTINE_NAME_MAX）と同じ
export const ROUTINE_NAME_MAX = 20;

// 自分の筋トレの記録を「ルーティン」として保存する（F3）。記録の詳細（S-21）の下に置く。
// 押すと名前の欄が開く。保存は電波があるときだけ（サーバーの DB に置くため。送信待ちには積まない）
export function SaveRoutine({ recordId }: { recordId: string }) {
  const queryClient = useQueryClient();
  const createRoutine = useCreateRoutine();
  const online = useOnline();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const trimmed = name.trim();
  const canSubmit = online && trimmed.length > 0 && !createRoutine.isPending;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;
    setError(null);
    try {
      const res = await createRoutine.mutateAsync({ data: { name: trimmed, recordId } });
      if (res.status === 201) {
        await queryClient.invalidateQueries({ queryKey: getListRoutinesQueryKey() });
        setSaved(trimmed);
        setOpen(false);
        setName('');
      } else {
        // 5つまで・同じ名前（409）など。API の文言（画面に出せる日本語）をそのまま見せる
        setError(messageOf(res.data, ROUTINE_MESSAGES.saveFailed));
      }
    } catch {
      setError(ROUTINE_MESSAGES.saveFailed);
    }
  }

  if (!open) {
    return (
      <div>
        <ThickButton
          tone="white"
          size="sm"
          className="w-full"
          disabled={!online}
          onClick={() => {
            setSaved(null);
            setOpen(true);
          }}
        >
          <Bookmark aria-hidden />
          {ROUTINE_MESSAGES.saveButton}
        </ThickButton>
        <p className="mt-2 text-center text-xs text-sub-strong">{ROUTINE_MESSAGES.saveHint}</p>
        {!online && <p className="mt-1 text-center text-xs text-sub-strong">{ROUTINE_MESSAGES.saveOffline}</p>}
        {saved && (
          <p role="status" className="mt-2 rounded-fl bg-teal-light px-4 py-3 text-sm font-bold text-ink">
            {ROUTINE_MESSAGES.saved(saved)}
          </p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="fl-slab space-y-3 px-4 py-4">
      <div className="space-y-2">
        <Label htmlFor="routine-name" className="font-extrabold">
          {ROUTINE_MESSAGES.nameLabel}
        </Label>
        <Input
          id="routine-name"
          value={name}
          maxLength={ROUTINE_NAME_MAX}
          placeholder={ROUTINE_MESSAGES.namePlaceholder}
          autoFocus
          onChange={(e) => setName(e.target.value)}
          className="h-12 rounded-fl border-2 text-base font-bold"
        />
        <p className="text-xs text-sub">{ROUTINE_MESSAGES.nameHint(ROUTINE_NAME_MAX)}</p>
      </div>
      {error && (
        <p role="alert" className="rounded-fl bg-coral-light px-4 py-3 text-sm font-bold text-ink">
          {error}
        </p>
      )}
      {!online && <p className="text-xs text-sub-strong">{ROUTINE_MESSAGES.saveOffline}</p>}
      <div className="flex gap-2">
        <ThickButton type="button" tone="white" size="sm" className="flex-1" onClick={() => setOpen(false)}>
          {ROUTINE_MESSAGES.cancel}
        </ThickButton>
        <ThickButton type="submit" size="sm" className="flex-1" disabled={!canSubmit}>
          {createRoutine.isPending ? ROUTINE_MESSAGES.saving : ROUTINE_MESSAGES.submit}
        </ThickButton>
      </div>
    </form>
  );
}
