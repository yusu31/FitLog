'use client';

import { X } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import { FullScreen } from '@/components/fitlog/full-screen';
import { ThickButton } from '@/components/fitlog/thick-button';
import { ApiError } from '@/lib/api/api-error';
import { useGetPrevious, useGetRecord, useListExercises } from '@/lib/api/generated';
import { messageOf } from '@/lib/api/message';
import { activeRecordId, recordForNextSet } from '@/lib/current-workout';
import { SYNC_MESSAGES } from '@/lib/messages';
import { useRecordMutations } from '@/lib/mutations';
import {
  clampReps,
  clampWeight,
  ghostDiff,
  initialDraft,
  nextSetNo,
  provisionalResult,
  stepReps,
  stepWeight,
  type SetValue,
} from '@/lib/record-flow';
import { volumeOf, type GhostResult } from '@/lib/shared/ghost';
import { useOnline } from '@/lib/use-browser-state';
import { useRequireSession } from '@/lib/use-require-session';
import { DoneSets, type DoneSet } from './done-sets';
import { GhostBar } from './ghost-bar';
import { ResultSheet, type SheetData } from './result-sheet';
import { StepperField } from './stepper-field';

type Outcome = { result: GhostResult | null; isPersonalBest: boolean };

const SEND_ERROR = '送れませんでした。電波の良い所でもう一度ためしてください';
const errorText = (e: unknown) => (e instanceof ApiError ? messageOf(e.body, SEND_ERROR) : SEND_ERROR);

// S-12 記録（筋トレ）（docs/screen-design.md 4章・features.md 2.3・2.5・2.6）。
// 種目・重量×回数・＋/−・前回のバー・「できた」（セットごと）・結果シート・「…」から削除。
// 最初の「できた」で記録（kind=workout）を作り、以降は同じ記録にセットを足す（3時間以上あいたら別の記録）
export function RecordView() {
  const { signedIn } = useRequireSession();
  const exerciseId = useSearchParams().get('exercise') ?? '';
  const online = useOnline();
  const mutations = useRecordMutations();

  const { data: exerciseData, isPending: exercisesPending } = useListExercises({ query: { enabled: signedIn } });
  const exercise = exerciseData?.status === 200 ? exerciseData.data.find((e) => e.id === exerciseId) : undefined;

  // 画面を開いた時刻。「今の記録の時刻より前」を前回にするため、API へ渡す（自分の記録を前回にしない）
  const [openedAt] = useState(() => new Date().toISOString());
  const { data: previousData, isPending: previousPending } = useGetPrevious(
    exerciseId,
    { before: openedAt },
    { query: { enabled: signedIn && !!exercise } },
  );
  const previous = previousData?.status === 200 ? previousData.data : undefined;

  const [recordId, setRecordId] = useState<string | null>(() => activeRecordId(Date.now()));
  // キャッシュの記録の詳細（楽観的更新の置き場所）を見るだけ。取りに行かない
  const { data: detailData } = useGetRecord(recordId ?? '', { query: { enabled: false } });
  const sets: DoneSet[] = useMemo(
    () => (detailData?.status === 200 ? (detailData.data.exercises?.find((e) => e.exerciseId === exerciseId)?.sets ?? []) : []),
    [detailData, exerciseId],
  );

  const setNo = nextSetNo(sets);
  const trial: SetValue | null =
    exercise && exercise.trialWeightKg !== null && exercise.trialReps !== null
      ? { weightKg: exercise.trialWeightKg, reps: exercise.trialReps }
      : null;
  const initial = initialDraft(previous?.previous?.sets, setNo, trial);

  // 利用者が直した値。一度直したら、次のセット以降もその値を引き継ぐ（features.md 2.3）
  const [edited, setEdited] = useState<SetValue | null>(null);
  const draft = edited ?? initial.draft;

  const [outcomes, setOutcomes] = useState<Record<string, Outcome>>({});
  const [sheet, setSheet] = useState<SheetData | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const dismissSheet = useCallback(() => setSheet(null), []);

  if (!signedIn || exercisesPending) return <Skeleton />;
  if (!exercise) {
    return (
      <FullScreen>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <p className="font-bold text-sub-strong">種目が見つかりませんでした</p>
          <Link href="/exercises" className="inline-flex min-h-11 items-center rounded-fl bg-teal-dark px-5 font-extrabold text-white">
            種目を選ぶ
          </Link>
        </div>
      </FullScreen>
    );
  }

  const ghost = initial.source === 'previous' ? initial.ghost : null; // お試し値とは結果を比べない
  const pastMax = (() => {
    const volumes = sets.map(volumeOf);
    if (previous?.personalBest) volumes.push(previous.personalBest.volume);
    return volumes.length > 0 ? Math.max(...volumes) : null;
  })();

  const done = sets.length;
  const total = Math.max(previous?.previous?.sets.length ?? 0, done, 1);
  const pct = Math.round((done / total) * 100);

  function onDone() {
    if (!exercise) return;
    const now = Date.now();
    const value = { weightKg: clampWeight(draft.weightKg), reps: clampReps(draft.reps) };
    const { recordId: rid, isNew } = recordForNextSet(now);
    if (isNew) {
      mutations.createRecord.mutate({ data: { id: rid, kind: 'workout', recordedAt: new Date(now).toISOString() } });
    }
    setRecordId(rid);

    const setId = crypto.randomUUID();
    const number = isNew ? 1 : setNo;
    const provisional = provisionalResult(ghost, value, pastMax);
    const summaryOf = `${exercise.name} ${value.weightKg}kg × ${value.reps}回`;
    const diff = ghost ? ghostDiff(ghost, value) : 0;
    setNotice(null);
    setOutcomes((o) => ({ ...o, [setId]: provisional }));
    setSheet({ setId, ...provisional, diff, summary: summaryOf, ...(online ? {} : { note: SYNC_MESSAGES.sheetNote }) });

    // 画面の仮の結果で先に見せ、API の応答が違えば直す（API が正）
    mutations.addSet
      .mutateAsync({ id: rid, data: { id: setId, exerciseId: exercise.id, setNo: number, weightKg: value.weightKg, reps: value.reps } })
      .then((res) => {
        const outcome: Outcome = { result: res.data.result, isPersonalBest: res.data.isPersonalBest };
        setOutcomes((o) => ({ ...o, [setId]: outcome }));
        setSheet((s) => (s && s.setId === setId ? { ...s, ...outcome, diff: ghost && outcome.result ? ghostDiff(ghost, value) : 0 } : s));
      })
      .catch((e: unknown) => {
        setNotice(errorText(e));
        setSheet((s) => (s && s.setId === setId ? null : s));
      });
  }

  function onDelete(set: DoneSet) {
    if (!recordId) return;
    setNotice(null);
    mutations.deleteSet.mutateAsync({ id: recordId, setId: set.id }).catch((e: unknown) => setNotice(errorText(e)));
  }

  const bestIds = new Set(Object.entries(outcomes).filter(([, o]) => o.isPersonalBest).map(([id]) => id));

  return (
    <FullScreen
      footer={
        <ThickButton onClick={onDone} disabled={previousPending}>
          できた
        </ThickButton>
      }
    >
      <header className="flex items-center gap-3 px-2 pt-4 pr-4">
        <Link
          href="/today"
          aria-label="とじる"
          className="flex size-11 items-center justify-center rounded-fl text-sub-strong outline-none focus-visible:ring-4 focus-visible:ring-teal/40"
        >
          <X aria-hidden className="size-6" />
        </Link>
        <div
          role="progressbar"
          aria-label="できたセット"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          className="h-4 flex-1 -skew-x-[14deg] overflow-hidden rounded-[5px] bg-line"
        >
          <i
            className="block h-full bg-[repeating-linear-gradient(-45deg,var(--color-teal)_0_6px,var(--color-teal-dark)_6px_12px)] transition-[width] duration-500 motion-reduce:transition-none"
            style={{ width: `${Math.max(pct, 6)}%` }}
          />
        </div>
      </header>

      <div className="flex flex-1 flex-col items-center gap-4 px-4 pt-4 pb-6">
        <p className="text-[13px] font-bold tracking-widest text-sub-strong">{setNo} セット目</p>
        <h1 className="text-center text-[32px] leading-tight font-extrabold">{exercise.name}</h1>

        <div className="w-full space-y-3">
          <StepperField
            label="重量（kg）"
            unit="kg"
            value={draft.weightKg}
            step={0.5}
            min={0}
            max={500}
            stepLabel="2.5kg"
            clamp={clampWeight}
            onChange={(n) => setEdited({ ...draft, weightKg: n })}
            onStep={(dir) => setEdited({ ...draft, weightKg: stepWeight(draft.weightKg, dir) })}
          />
          <StepperField
            label="回数"
            unit="回"
            value={draft.reps}
            step={1}
            min={1}
            max={999}
            stepLabel="1回"
            clamp={clampReps}
            color="text-teal-dark"
            onChange={(n) => setEdited({ ...draft, reps: n })}
            onStep={(dir) => setEdited({ ...draft, reps: stepReps(draft.reps, dir) })}
          />
        </div>

        {previousPending ? (
          <div aria-busy="true" aria-label="前回を読み込み中" className="h-24 w-full animate-pulse rounded-fl bg-face" />
        ) : (
          <GhostBar ghost={initial.ghost} current={draft} isTrial={initial.source === 'trial'} />
        )}

        {notice && (
          <p role="alert" className="w-full rounded-fl bg-coral-light px-4 py-3 text-sm font-bold text-ink">
            {notice}
          </p>
        )}

        <DoneSets sets={sets} bestIds={bestIds} online={online} onDelete={onDelete} />
        {/* 結果シートが重なる分の余白 */}
        <div aria-hidden className="h-24" />
      </div>

      <ResultSheet sheet={sheet} onDismiss={dismissSheet} />
    </FullScreen>
  );
}

function Skeleton() {
  return (
    <FullScreen>
      <div aria-busy="true" aria-label="読み込み中" className="space-y-4 px-4 pt-8">
        <div className="h-8 w-40 animate-pulse rounded-lg bg-face" />
        <div className="h-40 animate-pulse rounded-fl bg-face" />
        <div className="h-24 animate-pulse rounded-fl bg-face" />
      </div>
    </FullScreen>
  );
}
