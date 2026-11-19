'use client';

import { useQueryClient } from '@tanstack/react-query';
import { ListChecks, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/fitlog/confirm-dialog';
import { sendErrorText } from '@/lib/api/api-error';
import { getListRoutinesQueryKey, useDeleteRoutine, useListRoutines, type RoutineResponse } from '@/lib/api/generated';
import { setCopyPlan } from '@/lib/copy-plan';
import { withDay, type DayMode } from '@/lib/day-mode';
import { ROUTINE_MESSAGES } from '@/lib/messages';
import { useOnline } from '@/lib/use-browser-state';

// 今日の画面の「ルーティンから始める」（F3）。保存したルーティンが1つも無ければ何も出さない。
// 押すと、メニューのコピー（F-24）と同じ「やる予定」を記録画面へ渡す（記録は「できた」を押したときに初めて作る）。
// コピー元は自分なので、記録に copiedFromUserId は付けない（fromUserId: null）。予定は端末の中だけなので、電波が無くても始められる
export function RoutineStarter({ day }: { day: DayMode }) {
  const router = useRouter();
  const online = useOnline();
  const queryClient = useQueryClient();
  const { data } = useListRoutines();
  const deleteRoutine = useDeleteRoutine();
  const [confirming, setConfirming] = useState<RoutineResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const routines = data?.status === 200 ? data.data.items : [];
  if (routines.length === 0) return null;

  function onStart(routine: RoutineResponse) {
    const items = routine.exercises.map((e) => ({ exerciseId: e.exerciseId, name: e.name, sets: e.sets.map((s) => ({ weightKg: s.weightKg, reps: s.reps })) }));
    if (items.length === 0) return;
    setCopyPlan({ fromUserId: null, fromName: null, routineName: routine.name, items });
    router.push(withDay(`/record?exercise=${encodeURIComponent(items[0].exerciseId)}&plan=1`, day));
  }

  async function onDelete() {
    const target = confirming;
    setConfirming(null);
    if (!target) return;
    setError(null);
    try {
      const res = await deleteRoutine.mutateAsync({ id: target.id });
      if (res.status !== 204) throw new Error('delete');
      await queryClient.invalidateQueries({ queryKey: getListRoutinesQueryKey() });
    } catch (e) {
      setError(sendErrorText(e, ROUTINE_MESSAGES.deleteFailed));
    }
  }

  return (
    <section>
      <h2 className="mb-2 text-sm font-extrabold text-sub-strong">{ROUTINE_MESSAGES.heading}</h2>
      {error && (
        <p role="alert" className="mb-2 rounded-fl bg-coral-light px-4 py-3 text-sm font-bold text-ink">
          {error}
        </p>
      )}
      <ul aria-label={ROUTINE_MESSAGES.heading} className="space-y-2">
        {routines.map((r) => (
          <li key={r.id} className="fl-slab flex min-h-16 items-center gap-1 pr-1">
            <button
              type="button"
              aria-label={ROUTINE_MESSAGES.start(r.name)}
              onClick={() => onStart(r)}
              className="flex min-h-16 min-w-0 flex-1 items-center gap-3 rounded-fl px-3 text-left outline-none focus-visible:ring-4 focus-visible:ring-teal/40"
            >
              <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-full bg-teal-light text-teal-dark">
                <ListChecks className="size-6" />
              </span>
              <span className="min-w-0 flex-1 text-[15px] leading-tight font-extrabold">
                {r.name}
                <small className="block truncate text-xs font-bold text-sub-strong">{r.exercises.map((e) => e.name).join('・')}</small>
              </span>
            </button>
            <button
              type="button"
              aria-label={ROUTINE_MESSAGES.deleteLabel(r.name)}
              disabled={!online || deleteRoutine.isPending}
              onClick={() => setConfirming(r)}
              className="flex min-h-11 shrink-0 items-center justify-center gap-0.5 rounded-fl px-2 text-xs font-extrabold text-sub-strong outline-none focus-visible:ring-4 focus-visible:ring-teal/40 disabled:opacity-40"
            >
              <X aria-hidden className="size-4" />
              消す
            </button>
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={confirming !== null}
        title={ROUTINE_MESSAGES.deleteTitle}
        description={confirming ? ROUTINE_MESSAGES.deleteBody(confirming.name) : ''}
        confirmLabel="消す"
        onConfirm={() => void onDelete()}
        onCancel={() => setConfirming(null)}
      />
    </section>
  );
}
