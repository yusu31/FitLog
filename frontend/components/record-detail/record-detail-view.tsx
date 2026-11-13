'use client';

import { ChevronLeft, Moon, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { RouteMap } from './route-map';
import { SocialSection } from './social-section';
import { VideoPlayer } from './video-player';
import { ConfirmDialog } from '@/components/fitlog/confirm-dialog';
import { FullScreen } from '@/components/fitlog/full-screen';
import { ThickButton } from '@/components/fitlog/thick-button';
import { sendErrorText } from '@/lib/api/api-error';
import { useCreateExercise, useGetCurrentGroup, useGetPrevious, useGetRecord, useListExercises, type RecordDetailResponse, type RecordedExercise } from '@/lib/api/generated';
import { setCopyPlan } from '@/lib/copy-plan';
import {
  formatDistance,
  formatDuration,
  formatJstTime,
  formatMonthDay,
  formatPace,
  formatSet,
  WEEKDAYS,
  weekdayIndex,
} from '@/lib/format';
import { CopiedTag } from '@/components/fitlog/copied-tag';
import { LateTag } from '@/components/fitlog/late-tag';
import { DETAIL_MESSAGES, FRIEND_MESSAGES, GHOST_MESSAGES, ME_MESSAGES, RECORD_MESSAGES, ghostUpMessage } from '@/lib/messages';
import { useRecordMutations } from '@/lib/mutations';
import { setOutcomes } from '@/lib/record-detail';
import { useOnline } from '@/lib/use-browser-state';
import { useRequireSession } from '@/lib/use-require-session';

// S-21 記録の詳細（docs/screen-design.md 1章。v8 の部品の組み合わせ）。02-2 では記録の種類・日時・セット・ラン・取り消しまで。
// スタンプ・コメント・動画・ルートは 02-4 で足す（枠は置かない）。
// API の応答には「だれの記録か」が無い。自分の記録（自分タブから `&from=me` で来たとき）だけ、ゴースト比べと取り消しを出す
export function RecordDetailView() {
  const { signedIn } = useRequireSession();
  const params = useSearchParams();
  const id = params.get('id') ?? '';
  const mine = params.get('from') === 'me';
  // 仲間の足跡から来たとき、書いた人の userId（メニューのコピーのコピー元。サーバーが同じグループかを確かめる）
  const by = params.get('by') ?? '';
  const router = useRouter();
  const online = useOnline();
  const { deleteRecord } = useRecordMutations();
  const [confirming, setConfirming] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const { data, isPending, isError } = useGetRecord(id, { query: { enabled: signedIn && id !== '' } });
  const back = mine ? { href: '/me', label: DETAIL_MESSAGES.backMe } : { href: '/friends', label: DETAIL_MESSAGES.backFriends };

  function onDelete() {
    setConfirming(false);
    setRemoving(true);
    setNotice(null);
    deleteRecord
      .mutateAsync({ id })
      .then(() => router.replace('/me'))
      .catch((e: unknown) => {
        setRemoving(false);
        setNotice(sendErrorText(e, ME_MESSAGES.deleteError));
      });
  }

  const header = (
    <header className="flex items-center px-2 pt-4 pr-4">
      <Link
        href={back.href}
        aria-label={back.label}
        className="flex size-11 items-center justify-center rounded-fl text-sub-strong outline-none focus-visible:ring-4 focus-visible:ring-teal/40"
      >
        <ChevronLeft aria-hidden className="size-6" />
      </Link>
    </header>
  );

  if (!signedIn || (id !== '' && isPending)) {
    return (
      <FullScreen>
        {header}
        <div aria-busy="true" aria-label="読み込み中" className="space-y-3 px-4 pt-4">
          <div className="h-9 w-40 animate-pulse rounded-lg bg-face" />
          <div className="h-24 animate-pulse rounded-fl bg-face" />
          <div className="h-24 animate-pulse rounded-fl bg-face" />
        </div>
      </FullScreen>
    );
  }
  if (removing) {
    return (
      <FullScreen>
        {header}
        <p role="status" className="px-4 pt-8 text-center font-bold text-sub-strong">
          {DETAIL_MESSAGES.removing}
        </p>
      </FullScreen>
    );
  }
  // id が無い・存在しない・他人（別グループ）の記録は、どれも同じ 404（存在を教えない）
  if (id === '' || data?.status === 404) {
    return (
      <FullScreen>
        {header}
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 pb-16 text-center">
          <h1 className="text-xl font-extrabold">{DETAIL_MESSAGES.notFoundTitle}</h1>
          <p className="text-sm font-bold text-sub-strong">{DETAIL_MESSAGES.notFoundBody}</p>
          <Link href={back.href} className="mt-3 inline-flex min-h-11 items-center rounded-fl bg-teal-dark px-5 font-extrabold text-white">
            {back.label}
          </Link>
        </div>
      </FullScreen>
    );
  }
  if (isError || !data || data.status !== 200) {
    return (
      <FullScreen>
        {header}
        <p role="alert" className="mx-4 mt-4 rounded-fl bg-coral-light px-4 py-3 text-sm font-bold text-ink">
          {DETAIL_MESSAGES.loadFailed}
        </p>
      </FullScreen>
    );
  }

  const record = data.data;
  return (
    <FullScreen>
      {header}
      <div className="flex-1 space-y-4 px-4 pt-2 pb-8">
        <Heading record={record} />
        {notice && (
          <p role="alert" className="rounded-fl bg-coral-light px-4 py-3 text-sm font-bold text-ink">
            {notice}
          </p>
        )}
        {record.kind === 'workout' && <Workout record={record} mine={mine} />}
        {record.kind === 'workout' && !mine && by !== '' && (record.exercises?.length ?? 0) > 0 && <CopyButton record={record} fromUserId={by} />}
        {record.videoId && <VideoPlayer videoId={record.videoId} />}
        {record.kind === 'run' && record.run && <Run distanceM={record.run.distanceM} durationS={record.run.durationS} />}
        {record.kind === 'run' && record.run?.route && <RouteMap route={record.run.route} />}
        {record.kind === 'rest' && (
          <p className="fl-slab px-4 py-5 text-center text-sm font-bold text-sub-strong">{DETAIL_MESSAGES.restBody}</p>
        )}
        <SocialSection recordId={record.id} kind={record.kind} />
        {mine && (
          <div className="pt-2">
            <ThickButton tone="coral" size="sm" className="w-full" disabled={!online} onClick={() => setConfirming(true)}>
              <Trash2 aria-hidden />
              {DETAIL_MESSAGES.deleteButton}
            </ThickButton>
            {!online && <p className="mt-2 text-center text-xs text-sub-strong">{ME_MESSAGES.offlineNote}</p>}
          </div>
        )}
      </div>
      <ConfirmDialog
        open={confirming}
        title={ME_MESSAGES.deleteTitle}
        description={<>{record.kind === 'workout' ? ME_MESSAGES.deleteNote : 'この記録を取り消します。'}</>}
        confirmLabel="削除する"
        onConfirm={onDelete}
        onCancel={() => setConfirming(false)}
      />
    </FullScreen>
  );
}

const KIND_LABEL = {
  workout: DETAIL_MESSAGES.kindWorkout,
  run: DETAIL_MESSAGES.kindRun,
  rest: DETAIL_MESSAGES.kindRest,
} as const;

// 種類（見出し）と、日本時間の日付・曜日・時刻
function Heading({ record }: { record: RecordDetailResponse }) {
  return (
    <div>
      <h1 className="flex items-center gap-2 text-[28px] leading-tight font-extrabold">
        {record.kind === 'rest' && (
          <span aria-hidden className="flex size-7 shrink-0 items-center justify-center rounded-full bg-grape-dark text-white">
            <Moon className="size-4" />
          </span>
        )}
        {KIND_LABEL[record.kind]}
      </h1>
      <p className="mt-1 text-sm font-bold text-sub-strong">
        <span className="fl-num text-base text-ink">{formatMonthDay(record.localDate)}</span>（{WEEKDAYS[weekdayIndex(record.localDate)]}）
        {' '}
        {record.late ? <LateTag /> : formatJstTime(record.recordedAt)}
        {record.copiedFrom && <>{' '}<CopiedTag name={record.copiedFrom.name} /></>}
      </p>
    </div>
  );
}

// 仲間のメニューをコピーして始める（F-24）。種目と回数・重さを、今日の記録画面に「やる予定」として渡す。
// 記録はここでは作らない（「できた」を押したときに初めて作る）。自分の一覧に無い種目は、同じ名前の種目があればそれ、無ければ自分の種目として作る（仮置き）
function CopyButton({ record, fromUserId }: { record: RecordDetailResponse; fromUserId: string }) {
  const router = useRouter();
  const online = useOnline();
  const createExercise = useCreateExercise();
  const { data: exerciseData } = useListExercises();
  const { data: groupData } = useGetCurrentGroup();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mine = exerciseData?.status === 200 ? exerciseData.data : [];
  const fromName = groupData?.status === 200 ? (groupData.data.members.find((m) => m.id === fromUserId)?.name ?? null) : null;

  async function onCopy() {
    setBusy(true);
    setError(null);
    try {
      const items = [];
      for (const e of record.exercises ?? []) {
        let id = mine.find((m) => m.id === e.exerciseId)?.id ?? mine.find((m) => m.name.toLowerCase() === e.name.toLowerCase())?.id;
        if (!id) {
          const res = await createExercise.mutateAsync({ data: { name: e.name, bodyPart: e.bodyPart ?? 'chest' } });
          if (res.status !== 201) throw new Error('create');
          id = res.data.id;
        }
        items.push({ exerciseId: id, name: e.name, sets: e.sets.map((s) => ({ weightKg: s.weightKg, reps: s.reps })) });
      }
      setCopyPlan({ fromUserId, fromName, items });
      router.push(`/record?exercise=${encodeURIComponent(items[0].exerciseId)}&plan=1`);
    } catch (e) {
      setBusy(false);
      setError(sendErrorText(e, FRIEND_MESSAGES.copyFailed));
    }
  }

  return (
    <div>
      <ThickButton size="sm" className="w-full" disabled={!online || busy} onClick={() => void onCopy()}>
        {busy ? FRIEND_MESSAGES.copying : FRIEND_MESSAGES.copyButton}
      </ThickButton>
      {!online && <p className="mt-2 text-center text-xs text-sub-strong">{FRIEND_MESSAGES.copyOffline}</p>}
      {error && (
        <p role="alert" className="mt-2 rounded-fl bg-coral-light px-4 py-3 text-sm font-bold text-ink">
          {error}
        </p>
      )}
    </div>
  );
}

function Workout({ record, mine }: { record: RecordDetailResponse; mine: boolean }) {
  const exercises = record.exercises ?? [];
  if (exercises.length === 0) {
    return <p className="fl-slab px-4 py-5 text-center text-sm font-bold text-sub-strong">{DETAIL_MESSAGES.noSets}</p>;
  }
  return (
    <div className="space-y-4">
      {exercises.map((e) => (
        <ExerciseBlock key={e.exerciseId} exercise={e} recordedAt={record.recordedAt} mine={mine} />
      ))}
    </div>
  );
}

// 1種目ぶん。自分の記録なら、その記録より前の「前回」「自己ベスト」を取って、セットごとの結果を出す
// （取れない間・取れなかったときは、結果を出さずセットの値だけ出す）
function ExerciseBlock({ exercise, recordedAt, mine }: { exercise: RecordedExercise; recordedAt: string; mine: boolean }) {
  const { data } = useGetPrevious(exercise.exerciseId, { before: recordedAt }, { query: { enabled: mine } });
  const previous = mine && data?.status === 200 ? data.data : null;
  const outcomes = previous
    ? setOutcomes(exercise.sets, previous.previous?.sets ?? null, previous.personalBest?.volume ?? null)
    : null;

  return (
    <section aria-label={exercise.name}>
      <h2 className="mb-2 text-base font-extrabold">{exercise.name}</h2>
      <ol className="space-y-2">
        {exercise.sets.map((s, i) => {
          const o = outcomes?.[i];
          return (
            <li key={s.id} className="fl-slab flex min-h-14 flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
              <span className="w-12 shrink-0 text-xs font-bold text-sub-strong">セット{s.setNo}</span>
              <span className="fl-num min-w-0 flex-1 text-xl">{formatSet(s)}</span>
              {o?.isBest && <span className="fl-tag bg-gold !py-0 !text-xs !leading-4 text-ink">{RECORD_MESSAGES.best}</span>}
              {o && <span className="w-full pl-[60px] text-xs font-bold text-sub-strong">{resultText(o.result, o.diff)}</span>}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

const resultText = (result: 'up' | 'same' | 'down' | null, diff: number): string =>
  result === 'up' ? ghostUpMessage(diff) : result === 'same' ? GHOST_MESSAGES.same : result === 'down' ? GHOST_MESSAGES.down : RECORD_MESSAGES.recorded;

function Run({ distanceM, durationS }: { distanceM: number; durationS: number }) {
  const pace = formatPace(distanceM, durationS);
  return (
    <dl className="fl-slab grid grid-cols-3 gap-2 px-3 py-4 text-center">
      <Stat label="距離" value={formatDistance(distanceM)} />
      <Stat label="時間" value={formatDuration(durationS)} />
      <Stat label="ペース" value={pace ?? '—'} />
    </dl>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-bold text-sub-strong">{label}</dt>
      <dd className="fl-num mt-1 text-xl break-keep">{value}</dd>
    </div>
  );
}
