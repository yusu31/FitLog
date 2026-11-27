'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { ThickButton } from '@/components/fitlog/thick-button';
import { getGetFeedQueryKey, getGetRecordQueryKey, useUpdateRecordMemo } from '@/lib/api/generated';
import { CAPTION_MESSAGES as M } from '@/lib/messages';
import { useOnline } from '@/lib/use-browser-state';

// API の上限（records_caption_ck）と同じ。数え方はコードポイント（絵文字も1字）
export const CAPTION_MAX = 50;

// ひとこと（records.caption。PR 4）。仲間にも見える（メモ note は本人だけ）。
// 仲間の記録・ひとこと無しの仲間の記録では、あれば文だけ出す。自分の記録では書き直せる（保存は電波があるときだけ）
export function RecordCaption({ recordId, caption, mine }: { recordId: string; caption?: string; mine: boolean }) {
  const queryClient = useQueryClient();
  const update = useUpdateRecordMemo();
  const online = useOnline();
  const [text, setText] = useState(caption ?? '');
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  if (!mine) return caption ? <p className="fl-slab px-4 py-3 text-base font-bold">{caption}</p> : null;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!online || update.isPending) return;
    setMessage(null);
    try {
      const trimmed = text.trim();
      const res = await update.mutateAsync({ id: recordId, data: { caption: trimmed === '' ? null : trimmed } });
      if (res.status === 200) {
        await queryClient.invalidateQueries({ queryKey: getGetRecordQueryKey(recordId) });
        void queryClient.invalidateQueries({ queryKey: getGetFeedQueryKey() });
        setMessage({ kind: 'ok', text: M.saved });
      } else {
        setMessage({ kind: 'error', text: M.saveFailed });
      }
    } catch {
      setMessage({ kind: 'error', text: M.saveFailed });
    }
  }

  return (
    <section aria-labelledby="caption-heading" className="fl-slab space-y-3 px-4 py-4">
      <div>
        <h2 id="caption-heading" className="font-extrabold">
          {M.heading}
        </h2>
        <p className="text-note text-fg-subtle">{M.everyone}</p>
      </div>
      <form onSubmit={onSubmit} className="space-y-3">
        <label htmlFor="record-caption" className="sr-only">
          {M.heading}
        </label>
        <input
          id="record-caption"
          type="text"
          value={text}
          onChange={(e) => setText(Array.from(e.target.value).slice(0, CAPTION_MAX).join(''))}
          placeholder={M.placeholder}
          className="h-11 w-full rounded-fl border-2 border-line bg-white px-3 text-base font-bold text-fg outline-none focus-visible:ring-4 focus-visible:ring-teal/40"
        />
        <p className="text-right text-note font-bold text-fg-muted">
          {Array.from(text).length}/{CAPTION_MAX}
        </p>
        {message &&
          (message.kind === 'ok' ? (
            <p role="status" className="rounded-fl bg-teal-light px-4 py-3 text-sm font-bold text-fg">
              {message.text}
            </p>
          ) : (
            <p role="alert" className="rounded-fl bg-coral-light px-4 py-3 text-sm font-bold text-fg">
              {message.text}
            </p>
          ))}
        {!online && <p className="text-note text-fg-muted">{M.offline}</p>}
        <ThickButton type="submit" size="sm" className="w-full" disabled={!online || update.isPending}>
          {M.save}
        </ThickButton>
      </form>
    </section>
  );
}
