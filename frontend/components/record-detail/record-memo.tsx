'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { ThickButton } from '@/components/fitlog/thick-button';
import { Label } from '@/components/ui/label';
import { getGetRecordQueryKey, useUpdateRecordMemo } from '@/lib/api/generated';
import { MEMO_MESSAGES as M } from '@/lib/messages';
import { useOnline } from '@/lib/use-browser-state';

// API の上限（records_note_ck・records_rpe_ck）と同じ
export const NOTE_MAX = 200;
const RPE_VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
// きつさの目安（A03-7）。1・5・10 だけ添える。言葉は messages.ts の rpeLabel（1 らく 〜 10 限界）と合わせる
const RPE_GUIDE = [
  { value: 1, text: 'らく（ほとんど疲れない）' },
  { value: 5, text: 'ややきつい（あと5回はできそう）' },
  { value: 10, text: '限界（もう1回もできない）' },
] as const;

// 記録のメモ・きつさ（F5）。自分の記録の詳細（S-21）にだけ出す。サーバーの DB に置くので、保存は電波があるときだけ
export function RecordMemo({ recordId, note, rpe }: { recordId: string; note?: string; rpe?: number }) {
  const queryClient = useQueryClient();
  const update = useUpdateRecordMemo();
  const online = useOnline();
  const [text, setText] = useState(note ?? '');
  const [level, setLevel] = useState<number | null>(rpe ?? null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!online || update.isPending) return;
    setMessage(null);
    try {
      const trimmed = text.trim();
      const res = await update.mutateAsync({ id: recordId, data: { note: trimmed === '' ? null : trimmed, rpe: level } });
      if (res.status === 200) {
        await queryClient.invalidateQueries({ queryKey: getGetRecordQueryKey(recordId) });
        setMessage({ kind: 'ok', text: M.saved });
      } else {
        setMessage({ kind: 'error', text: M.saveFailed });
      }
    } catch {
      setMessage({ kind: 'error', text: M.saveFailed });
    }
  }

  return (
    <section aria-labelledby="memo-heading" className="fl-slab space-y-3 px-4 py-4">
      <div>
        <h2 id="memo-heading" className="font-extrabold">
          {M.heading}
        </h2>
        <p className="text-note text-fg-subtle">{M.onlyMe}</p>
      </div>
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="space-y-2">
          <p className="text-sm font-bold">{M.rpeLabel}</p>
          <div className="flex flex-wrap gap-2">
            {RPE_VALUES.map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={level === v}
                onClick={() => setLevel(level === v ? null : v)}
                className={`flex size-11 items-center justify-center rounded-fl border-2 text-base font-extrabold outline-none focus-visible:ring-4 focus-visible:ring-teal/40 ${
                  level === v ? 'border-teal-dark bg-teal-dark text-white' : 'border-line bg-canvas text-fg'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
          <ul aria-label="きつさの目安" className="space-y-0.5 text-note text-fg-muted">
            {RPE_GUIDE.map((g) => (
              <li key={g.value}>
                <span className="fl-num font-extrabold text-fg">{g.value}</span> {g.text}
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-2">
          <Label htmlFor="record-note" className="font-extrabold">
            {M.noteLabel}
          </Label>
          <textarea
            id="record-note"
            value={text}
            maxLength={NOTE_MAX}
            rows={3}
            placeholder={M.notePlaceholder}
            onChange={(e) => setText(e.target.value)}
            className="w-full rounded-fl border-2 border-line bg-surface px-3 py-2 text-base outline-none focus-visible:ring-4 focus-visible:ring-teal/40"
          />
        </div>
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
