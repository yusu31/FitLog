'use client';

import { Check, Ellipsis, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ThickButton } from '@/components/fitlog/thick-button';
import { RECORD_MESSAGES } from '@/lib/messages';

export type DoneSet = { id: string; setNo: number; weightKg: number; reps: number };

// できたセットの一覧。押したセットの横の「…」から「削除」を選ぶ（左スワイプは使わない: 見つけにくく誤操作もある。screen-design.md）。
// 削除は確認ダイアログつきで、電波があるときだけ押せる
export function DoneSets({
  sets,
  bestIds,
  online,
  onDelete,
}: {
  sets: DoneSet[];
  bestIds: ReadonlySet<string>;
  online: boolean;
  onDelete: (set: DoneSet) => void;
}) {
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<DoneSet | null>(null);
  useEffect(() => {
    if (!menuFor && !confirming) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setConfirming(null);
      setMenuFor(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuFor, confirming]);

  if (sets.length === 0) return null;
  return (
    <>
      <ol aria-label="できたセット" className="flex w-full flex-col gap-2">
        {sets.map((s) => (
          <li key={s.id} className="fl-slab relative flex min-h-14 items-center gap-3 py-1.5 pr-1 pl-2.5">
            <span aria-hidden className="flex size-[34px] shrink-0 items-center justify-center rounded-full bg-gold text-ink">
              <Check className="size-5" strokeWidth={3} />
            </span>
            <span className="flex-1 leading-tight">
              <span className="block text-xs text-sub-strong">セット{s.setNo}</span>
              <span className="fl-num text-xl">
                {s.weightKg}kg × {s.reps}回
              </span>
            </span>
            {bestIds.has(s.id) && <span className="fl-tag bg-gold !py-0 !text-xs !leading-4 text-ink">{RECORD_MESSAGES.best}</span>}
            <button
              type="button"
              aria-label={`セット${s.setNo}の メニュー`}
              aria-haspopup="menu"
              aria-expanded={menuFor === s.id}
              onClick={() => setMenuFor(menuFor === s.id ? null : s.id)}
              className="flex size-11 items-center justify-center rounded-fl text-sub-strong outline-none focus-visible:ring-4 focus-visible:ring-teal/40"
            >
              <Ellipsis aria-hidden className="size-6" />
            </button>
            {menuFor === s.id && (
              <div role="menu" className="absolute top-full right-1 z-10 mt-1 w-56 rounded-fl border-2 border-line bg-white p-1 shadow-lg">
                <button
                  type="button"
                  role="menuitem"
                  disabled={!online}
                  onClick={() => {
                    setMenuFor(null);
                    setConfirming(s);
                  }}
                  className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left font-extrabold text-coral-strong outline-none focus-visible:ring-4 focus-visible:ring-teal/40 disabled:text-sub disabled:opacity-100"
                >
                  <Trash2 aria-hidden className="size-5" />
                  削除
                </button>
                {!online && <p className="px-3 pb-2 text-xs text-sub-strong">電波があるときだけ 消せます</p>}
              </div>
            )}
          </li>
        ))}
      </ol>

      {confirming && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-ink/50 p-4 sm:items-center">
          <div role="alertdialog" aria-modal="true" aria-labelledby="del-title" aria-describedby="del-desc" className="w-full max-w-sm rounded-2xl bg-white p-5">
            <h2 id="del-title" className="text-xl font-extrabold">
              このセットを 消しますか？
            </h2>
            <p id="del-desc" className="mt-2 text-sm text-sub-strong">
              セット{confirming.setNo} ・ <span className="fl-num text-base text-ink">{confirming.weightKg}kg × {confirming.reps}回</span> を取り消します。
            </p>
            <div className="mt-5 flex gap-2">
              <ThickButton autoFocus tone="white" size="sm" className="flex-1" onClick={() => setConfirming(null)}>
                やめる
              </ThickButton>
              <ThickButton
                tone="coral"
                size="sm"
                className="flex-1"
                onClick={() => {
                  onDelete(confirming);
                  setConfirming(null);
                }}
              >
                削除する
              </ThickButton>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
