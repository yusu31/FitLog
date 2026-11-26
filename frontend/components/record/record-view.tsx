'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Ellipsis, Moon, Timer, Video, X } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { FullScreen } from '@/components/fitlog/full-screen';
import { SyncBanner } from '@/components/fitlog/sync-banner';
import { MyChara } from '@/components/fitlog/my-chara';
import { buttonClass, ThickButton } from '@/components/fitlog/thick-button';
import { ApiError } from '@/lib/api/api-error';
import { getGetVideosThisWeekQueryKey, ListRecordsKind, getCalories, getStats, useGetPrevious, useGetRecord, useGetStats, useListExercises, useListRecords } from '@/lib/api/generated';
import { messageOf } from '@/lib/api/message';
import { formatResumeProgress, formatSetProgress, formatSetWithReps } from '@/lib/format';
import { activeRecordId, noteBest, recordForNextSet } from '@/lib/current-workout';
import { getCopyPlan, markCopyPlanUsed, planGhostLabel, planHeading, planSetsFor } from '@/lib/copy-plan';
import { dayDateOf, parseDayMode, recordedAtFor, withDay } from '@/lib/day-mode';
import { toLocalDate } from '@/lib/shared/local-date';
import { daysBetween } from '@/lib/welcome-back';
import { LATE_MESSAGES, RECORD_CLOSE_MESSAGES, RECORD_MESSAGES, SYNC_MESSAGES } from '@/lib/messages';
import { monthDayCount } from '@/lib/stats';
import { buildMenu } from '@/lib/today-menu';
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
  stepWeightBig,
  type SetValue,
} from '@/lib/record-flow';
import { volumeOf, type GhostResult } from '@/lib/shared/ghost';
import { useOnline } from '@/lib/use-browser-state';
import { useFriendGhosts } from '@/lib/use-friend-ghosts';
import { readRestSeconds } from '@/lib/rest-timer';
import { useRequireSession } from '@/lib/use-require-session';
import { DoneSets, type DoneSet } from './done-sets';
import { FriendPicker } from './friend-picker';
import { GhostBar } from './ghost-bar';
import { RestTimerBar } from './rest-timer-bar';
import { ResultSheet, type SheetData } from './result-sheet';
import { fromUnit, stepLb, toUnit } from '@/lib/unit';
import { useWeightUnit } from '@/lib/use-preferences';
import { StepperField } from './stepper-field';
import { VideoRecorder, canRecordVideo } from './video-recorder';
import { hasFilmFirst, setFilmFirst } from '@/lib/film-first';

const noSubscribe = () => () => {};
// 押したときの時刻（イベントの中だけで使う）
const nowMs = () => Date.now();

// 「できた」の下に並べる副ボタンの形（D3-7）。共通の副ボタンを、横に3つ並ぶ大きさにしたもの
const SUB_BUTTON = buttonClass({ variant: 'secondary', size: 'sm' }, 'min-h-12 px-2 text-[15px]');

type Outcome = { result: GhostResult | null; isPersonalBest: boolean };

const SEND_ERROR = '送れませんでした。電波の良い所でもう一度ためしてください';
const errorText = (e: unknown) => (e instanceof ApiError ? messageOf(e.body, SEND_ERROR) : SEND_ERROR);

// S-12 記録（筋トレ）（docs/screen-design.md 4章・features.md 2.3・2.5・2.6）。
// 種目・重量×回数・＋/−・前回のバー・「できた」（セットごと）・結果シート・「…」から削除。
// 最初の「できた」で記録（kind=workout）を作り、以降は同じ記録にセットを足す（3時間以上あいたら別の記録）
export function RecordView() {
  const unit = useWeightUnit();
  const { signedIn } = useRequireSession();
  const params = useSearchParams();
  const exerciseId = params.get('exercise') ?? '';
  // きのうの分（F-21）。?day=yesterday のとき、きのうの12:00（日本時間）の記録として late つきで送る
  const day = parseDayMode(params.get('day'));
  const online = useOnline();
  const mutations = useRecordMutations();

  const { data: exerciseData, isPending: exercisesPending } = useListExercises({ query: { enabled: signedIn } });
  const exercise = exerciseData?.status === 200 ? exerciseData.data.find((e) => e.id === exerciseId) : undefined;

  // 画面を開いた時刻（きのうの分は、きのうの12:00）。「今の記録の時刻より前」を前回にするため、API へ渡す（自分の記録を前回にしない）
  const [openedAt] = useState(() => recordedAtFor(day, new Date()));
  const { data: previousData, isPending: previousPending } = useGetPrevious(
    exerciseId,
    { before: openedAt },
    { query: { enabled: signedIn && !!exercise } },
  );
  const previous = previousData?.status === 200 ? previousData.data : undefined;

  // 祝福の「今月◯日目」（F-20）。画面を開いたときの集計を使う。取れていなければ出さない
  const { data: statsData } = useGetStats({ date: dayDateOf(day, new Date()) }, { query: { enabled: signedIn } });
  const monthDay = statsData?.status === 200 ? monthDayCount(statsData.data) : undefined;
  // 開いた時点でとっていたスタンプ。保存のあとに増えた分を、結果シートでお祝いする（D5 PR-2）
  const earnedRef = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!earnedRef.current && statsData?.status === 200) earnedRef.current = new Set(statsData.data.stamps.filter((s) => s.earned).map((s) => s.key));
  }, [statsData]);

  // 続きの記録（N2）。メモリにあればそれ。ページを読み直してメモリが消えたときは、サーバーが「記録中」と返した今日の記録を使う
  // （今日の画面と同じ条件の一覧なので、キャッシュを共有する）。きのうの分は、今日の記録に混ざらないよう使わない
  const workouts = useListRecords({ kind: ListRecordsKind.workout, limit: '5' }, { query: { enabled: signedIn } });
  const serverActiveId =
    day === 'today' && workouts.data?.status === 200
      ? (workouts.data.data.items.find((r) => r.active === true && r.localDate === dayDateOf('today', new Date()))?.id ?? null)
      : null;
  // 次の種目（N3）。今日のメニュー（今日の画面と同じ組み立て）で、まだできていない、いまの種目以外の先頭。無ければ種目の一覧
  const nextExerciseId =
    workouts.data?.status === 200
      ? buildMenu(workouts.data.data.items, dayDateOf(day, new Date())).items.find((i) => !i.done && i.exerciseId !== exerciseId)?.exerciseId
      : undefined;
  const [memoryRecordId, setRecordId] = useState<string | null>(() => activeRecordId(Date.now(), day));
  const recordId = memoryRecordId ?? serverActiveId;
  // 記録の詳細（楽観的更新の置き場所）。メモリの記録はキャッシュを見るだけ。サーバーの記録を続きにしたときだけ取りに行く
  const { data: detailData } = useGetRecord(recordId ?? '', { query: { enabled: memoryRecordId === null && serverActiveId !== null } });
  const sets: DoneSet[] = useMemo(
    () => (detailData?.status === 200 ? (detailData.data.exercises?.find((e) => e.exerciseId === exerciseId)?.sets ?? []) : []),
    [detailData, exerciseId],
  );

  const setNo = nextSetNo(sets);
  const trial: SetValue | null =
    exercise && exercise.trialWeightKg !== null && exercise.trialReps !== null
      ? { weightKg: exercise.trialWeightKg, reps: exercise.trialReps }
      : null;
  // メニューのコピー（F-24）で来たとき、その種目の「やる予定」を前回の代わりの目標にする
  const [plan] = useState(() => (params.get('plan') === '1' ? getCopyPlan() : null));
  const planSets = planSetsFor(plan, exerciseId);
  // 入力の初期値は、今日の画面の「目標」と同じ値にそろえる（A02-5）。メニューのコピー（やる予定）のときだけ、やる予定の値のまま
  const daysSince = previous?.previous ? daysBetween(toLocalDate(new Date(previous.previous.recordedAt)), dayDateOf(day, new Date())) : null;
  const initial = initialDraft(planSets ?? previous?.previous?.sets, setNo, trial, planSets ? undefined : { daysSince });

  // 仲間のゴースト（F-16）。選んだ仲間だけバーに出す
  const friends = useFriendGhosts(exerciseId, openedAt, setNo, signedIn && !!exercise);
  const [pickedFriends, setPickedFriends] = useState<string[]>([]);
  const togglePicked = (id: string) => setPickedFriends((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const barFriends = friends.flatMap((f) => (pickedFriends.includes(f.id) && f.value ? [{ id: f.id, name: f.name, shirtColor: f.shirtColor, value: f.value }] : []));

  // 利用者が直した値。一度直したら、次のセット以降もその値を引き継ぐ（features.md 2.3）
  const [edited, setEdited] = useState<SetValue | null>(null);
  const draft = edited ?? initial.draft;
  // 自重の種目（固定の種目で目安の重さが 0）は回数だけ見せる。懸垂に足す重りなどは「おもりをつける」で出す（D3-11）
  const [addWeight, setAddWeight] = useState(false);
  const bodyweightOnly = !!exercise && !exercise.isCustom && exercise.trialWeightKg === 0 && draft.weightKg === 0 && !addWeight;

  const [outcomes, setOutcomes] = useState<Record<string, Outcome>>({});
  const [sheet, setSheet] = useState<SheetData | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // 休憩タイマー（F-34）。「できた」のたびに開き直す（startedAt が変わると部品ごと作り直す）。きのうの分（あとから記録）では始めない
  const [rest, setRest] = useState<{ startedAt: number; seconds: number } | null>(null);
  const dismissSheet = useCallback(() => setSheet(null), []);
  // 2秒動画（F-13）。撮れる端末で、電波があり、1セット以上できた後だけ入口を出す（署名付き URL をもらうには API に届く必要がある）
  const videoCapable = useSyncExternalStore(noSubscribe, canRecordVideo, () => false);
  const [filming, setFilming] = useState(false);
  const queryClient = useQueryClient();
  // 撮れていれば仲間の動画の鍵がすぐ外れるように、鍵の条件を取り直す（#438）
  const closeFilming = () => {
    setFilming(false);
    void queryClient.invalidateQueries({ queryKey: getGetVideosThisWeekQueryKey() });
  };
  // 左上の ✕ で閉じる前の確認（A03-5）。1セットもできていなければ確認なしで閉じる
  const [closing, setClosing] = useState(false);
  // この画面で「できた」を押した回数（もとから入っていたセットと分ける）
  const [addedHere, setAddedHere] = useState(0);
  // 「…」のシート（休憩する・2秒動画。D3-7）
  const [more, setMore] = useState(false);

  if (!signedIn || exercisesPending) return <Skeleton />;
  if (!exercise) {
    return (
      <FullScreen>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <p className="font-bold text-fg-muted">種目が見つかりませんでした</p>
          <Link href="/exercises" className={buttonClass({ variant: 'primary', size: 'sm' })}>
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
  // 続きの記録（3時間以内）を開いたとき、もとから入っていたセット。始めたばかりの「できた」と言い分ける（D3 L12）
  const carried = Math.max(0, done - addedHere);
  const previousCount = previous?.previous?.sets.length ?? 0;
  const progressText = carried > 0 ? formatResumeProgress(carried, addedHere, previousCount) : formatSetProgress(done, previousCount);
  const total = Math.max(previous?.previous?.sets.length ?? 0, done, 1);
  const pct = Math.round((done / total) * 100);

  function onDone() {
    if (!exercise) return;
    const now = nowMs();
    const value = { weightKg: clampWeight(draft.weightKg), reps: clampReps(draft.reps) };
    const { recordId: rid, isNew } = recordForNextSet(now, day, serverActiveId);
    if (isNew) {
      // コピーして始めた記録だけ、コピー元を付ける（最初の記録だけ。以降は付けない）
      const copiedFromUserId = plan && !plan.used ? (plan.fromUserId ?? undefined) : undefined;
      if (copiedFromUserId) markCopyPlanUsed();
      mutations.createRecord.mutate({
        data: {
          id: rid,
          kind: 'workout',
          recordedAt: recordedAtFor(day, new Date(now)),
          ...(day === 'yesterday' ? { late: true } : {}),
          ...(copiedFromUserId ? { copiedFromUserId } : {}),
        },
      });
    }
    setRecordId(rid);
    // ＋のシートで「2秒動画を撮る」を選んでいたら、最初の1セットのあとに撮影を開く（予約はその場で消す）
    if (isNew && day === 'today' && videoCapable && hasFilmFirst()) {
      setFilmFirst(false);
      setFilming(true);
    }

    const setId = crypto.randomUUID();
    setAddedHere((n) => n + 1);
    const number = isNew ? 1 : setNo;
    const provisional = provisionalResult(ghost, value, pastMax);
    const summaryOf = `${exercise.name} ${formatSetWithReps(value, unit)}`;
    const diff = ghost ? ghostDiff(ghost, value) : 0;
    setNotice(null);
    // 休憩は「できた」で自動で始める（D3 PR-4・本人の選択。A03-2 を上書き）。きのうの分（あとから記録）では始めない。次の「できた」では作り直す
    setRest(day === 'today' ? { startedAt: nowMs(), seconds: readRestSeconds() } : null);
    setOutcomes((o) => ({ ...o, [setId]: provisional }));
    // 今日の記録で使った部位（F-19）。この記録に入っている種目と、いまの種目の部位
    const bodyPartOf = (id: string) => (exerciseData?.status === 200 ? exerciseData.data.find((e) => e.id === id)?.bodyPart : undefined);
    const todayParts = [
      ...new Set(
        [...(detailData?.status === 200 ? (detailData.data.exercises ?? []).map((e) => bodyPartOf(e.exerciseId)) : []), exercise.bodyPart].filter(
          (p): p is NonNullable<typeof p> => !!p,
        ),
      ),
    ];
    setSheet({ setId, ...provisional, diff, summary: summaryOf, parts: todayParts, day, ...(monthDay === undefined ? {} : { monthDay }), ...(online ? {} : { note: SYNC_MESSAGES.sheetNote }) });

    // 画面の仮の結果で先に見せ、API の応答が違えば直す（API が正）
    mutations.addSet
      .mutateAsync({ id: rid, data: { id: setId, exerciseId: exercise.id, setNo: number, weightKg: value.weightKg, reps: value.reps } })
      .then((res) => {
        const outcome: Outcome = { result: res.data.result, isPersonalBest: res.data.isPersonalBest };
        if (outcome.isPersonalBest) noteBest(rid, exercise.name); // 終了のまとめの「自己ベスト◯回」用
        setOutcomes((o) => ({ ...o, [setId]: outcome }));
        setSheet((s) => (s && s.setId === setId ? { ...s, ...outcome, diff: ghost && outcome.result ? ghostDiff(ghost, value) : 0 } : s));
        // 推定消費カロリー（B14b）。体重が無い・時間が測れない（1セットだけ）ときは null で、板には出さない。届かなくても板は変えない
        getCalories(rid)
          .then((c) => {
            const kcal = c.status === 200 ? c.data.kcal : null;
            if (kcal) setSheet((s) => (s && s.setId === setId ? { ...s, kcal } : s));
          })
          .catch(() => {});
        // 新しくとったスタンプ（D5 PR-2）。開いたときの集計と比べる。取れなければお祝いしないだけ
        const known = earnedRef.current;
        if (known) {
          getStats({ date: dayDateOf(day, new Date()) })
            .then((r) => {
              if (r.status !== 200) return;
              const fresh = r.data.stamps.filter((st) => st.earned && !known.has(st.key)).map((st) => st.key);
              for (const k of fresh) known.add(k);
              if (fresh.length > 0) setSheet((cur) => (cur && cur.setId === setId ? { ...cur, newStamps: fresh } : cur));
            })
            .catch(() => {});
        }
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

  const closeHref = withDay('/today', day);
  const canFilm = videoCapable && online && day === 'today' && !!recordId;
  const bestIds = new Set(Object.entries(outcomes).filter(([, o]) => o.isPersonalBest).map(([id]) => id));

  return (
    <FullScreen>
      <SyncBanner />
      <header className="flex items-center gap-3 px-2 pt-4 pr-4">
        {sets.length > 0 ? (
          <ThickButton variant="icon"
            aria-label="とじる"
            onClick={() => setClosing(true)}
            className={buttonClass({ variant: 'icon' }, '[&_svg]:size-7')}
          >
            <X aria-hidden className="size-6" />
          </ThickButton>
        ) : (
          <Link
            href={closeHref}
            aria-label="とじる"
            className={buttonClass({ variant: 'icon' }, '[&_svg]:size-7')}
          >
            <X aria-hidden className="size-6" />
          </Link>
        )}
        <div
          role="progressbar"
          aria-label="できたセット"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuetext={progressText}
          className="h-4 flex-1 -skew-x-[14deg] overflow-hidden rounded-[5px] bg-line"
        >
          <i
            className="block h-full bg-[repeating-linear-gradient(-45deg,var(--color-teal)_0_6px,var(--color-teal-dark)_6px_12px)] transition-[width] duration-500 motion-reduce:transition-none"
            style={{ width: `${Math.max(pct, 6)}%` }}
          />
        </div>
        <MyChara pose="train" size={64} />
      </header>
      <p data-testid="set-progress" className="px-4 pt-1 text-note font-bold text-fg-muted">
        {progressText}
      </p>
      {rest && <RestTimerBar key={rest.startedAt} startedAt={rest.startedAt} initialSeconds={rest.seconds} onClose={() => setRest(null)} />}

      {day === 'yesterday' && (
        <p role="status" className="mx-4 mt-2 rounded-fl bg-gold-light px-4 py-2 text-center text-sm font-extrabold text-fg">
          {LATE_MESSAGES.banner}
        </p>
      )}
      {plan && (
        <nav aria-label={planHeading(plan)} className="mx-4 mt-2 rounded-fl bg-teal-light px-4 py-2">
          <p className="text-note font-extrabold text-fg">{planHeading(plan)}</p>
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {plan.items.map((i) => (
              <li key={i.exerciseId}>
                <Link
                  href={withDay(`/record?exercise=${encodeURIComponent(i.exerciseId)}&plan=1`, day)}
                  aria-current={i.exerciseId === exerciseId ? 'page' : undefined}
                  className={`inline-flex min-h-11 items-center rounded-full border-2 px-3 text-sm font-extrabold ${i.exerciseId === exerciseId ? 'border-teal-dark bg-surface' : 'border-transparent bg-surface/60'}`}
                >
                  {i.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
      <div className={`flex flex-1 flex-col items-center gap-4 px-4 pt-4 pb-6`}>
        <p className="text-sm font-extrabold tracking-widest text-fg-muted">{RECORD_MESSAGES.setNow(setNo)}</p>
        <h1 className="text-center text-page-title leading-tight font-extrabold">{exercise.name}</h1>

        <div className="w-full space-y-3">
          {bodyweightOnly ? (
            <div className="flex items-center justify-between gap-2 rounded-fl bg-canvas px-4 py-2">
              <p className="text-sm font-extrabold text-fg-muted">{RECORD_MESSAGES.bodyweight}</p>
              <ThickButton tone="white" size="sm" onClick={() => setAddWeight(true)}>
                {RECORD_MESSAGES.addWeight}
              </ThickButton>
            </div>
          ) : (
          <StepperField
            label={`重量（${unit}）`}
            unit={unit}
            value={toUnit(draft.weightKg, unit)}
            step={unit === 'kg' ? 0.5 : 5}
            min={0}
            max={toUnit(500, unit)}
            stepLabel={unit === 'kg' ? '2.5kg' : '5lb'}
            // lb は 5lb 刻みで動かし、kg（0.5 刻み）に直して保存する
            clamp={unit === 'kg' ? clampWeight : (n) => n}
            onChange={(n) => setEdited({ ...draft, weightKg: clampWeight(fromUnit(n, unit)) })}
            onStep={(dir) => setEdited({ ...draft, weightKg: unit === 'kg' ? stepWeight(draft.weightKg, dir) : clampWeight(fromUnit(stepLb(draft.weightKg, dir), 'lb')) })}
            bigStepLabel={unit === 'kg' ? '10kg' : '25lb'}
            onBigStep={(dir) => setEdited({ ...draft, weightKg: unit === 'kg' ? stepWeightBig(draft.weightKg, dir) : clampWeight(fromUnit(stepLb(draft.weightKg, dir, 25), 'lb')) })}
          />
          )}
          <StepperField
            label="回数"
            unit="回"
            value={draft.reps}
            step={1}
            min={1}
            max={999}
            stepLabel="1回"
            clamp={clampReps}
            color="text-brand"
            onChange={(n) => setEdited({ ...draft, reps: n })}
            onStep={(dir) => setEdited({ ...draft, reps: stepReps(draft.reps, dir) })}
          />
        </div>

        {initial.target && (
          <p data-testid="target-hint" className="text-center text-note font-bold text-fg-muted">
            {RECORD_MESSAGES.target(initial.target.weightKg === 0 ? '自重' : `${toUnit(initial.target.weightKg, unit)}${unit}`, initial.target.reps)}
          </p>
        )}
        <p className="text-center text-note font-bold text-fg-muted">{RECORD_MESSAGES.typeHint}</p>
        {initial.restReturn && (
          <p data-testid="rest-return-note" className="w-full rounded-fl bg-teal-light px-4 py-2 text-center text-sm font-bold text-fg">
            {RECORD_MESSAGES.restReturn}
          </p>
        )}

        {previousPending ? (
          <div aria-busy="true" aria-label="前回を読み込み中" className="h-24 w-full animate-pulse rounded-fl bg-canvas" />
        ) : (
          <GhostBar
            ghost={initial.ghost}
            current={draft}
            isTrial={initial.source === 'trial'}
            friends={barFriends}
            {...(planSets && plan ? { label: planGhostLabel(plan) } : {})}
          />
        )}

        {/* 「できた」は入力欄のすぐ下に置く。画面の下に固定すると、小さい画面や文字を大きくした画面で入力欄を覆う（A12-3） */}
        <div className="w-full space-y-1">
          <ThickButton onClick={onDone} disabled={previousPending} aria-describedby={previousPending ? 'done-reason' : undefined}>
            できた
          </ThickButton>
          {previousPending && (
            <p id="done-reason" className="text-center text-note font-bold text-fg-muted">
              {RECORD_MESSAGES.waitPrevious}
            </p>
          )}
        </div>

        {notice && (
          <p role="alert" className="w-full rounded-fl bg-coral-light px-4 py-3 text-sm font-bold text-fg">
            {notice}
          </p>
        )}

        {/* 結果の板は、画面の下に固定せず、ここ（「できた」のすぐ下）に流す。数秒で畳む（A03-1） */}
  
        {/* D3-10: できたセット（ベストの札つき）は「できた」のすぐ下＝画面の上のほうに置く */}
        <DoneSets sets={sets} bestIds={bestIds} online={online} onDelete={onDelete} />

        {/* D3-7: 主は「できた」1つ。副は「次の種目へ」「今日はここまで」の2つだけにし、休憩・2秒動画は「…」のシートへ。
            1セットで終えたいときの出口（A03-2）は今日の画面の「今日はここまで」 */}
        {sets.length > 0 && (
          <div className="flex w-full gap-2">
            <Link
              href={nextExerciseId ? withDay(`/record?exercise=${encodeURIComponent(nextExerciseId)}`, day) : withDay('/exercises', day)}
              className={`${SUB_BUTTON} flex-1`}
            >
              次の種目へ
            </Link>
            <Link href={closeHref} className={`${SUB_BUTTON} flex-1`}>
              <Moon aria-hidden className="size-5" />
              {RECORD_MESSAGES.stop}
            </Link>
            {(day === 'today' || canFilm) && (
              <button type="button" aria-label="ほかの操作" aria-haspopup="dialog" className={`${SUB_BUTTON} w-14 shrink-0`} onClick={() => setMore(true)}>
                <Ellipsis aria-hidden className="size-6" />
              </button>
            )}
          </div>
        )}

        {/* 筋トレ中は畳んでおく（A02-11） */}
        <FriendPicker friends={friends} selected={pickedFriends} onToggle={togglePicked} />
      </div>

      <ResultSheet sheet={sheet} onDismiss={dismissSheet} />
      {/* 休憩の帯（画面の下に固定）の高さぶん、ページの一番下を空ける。結果の表示は本文の箱の外（ページの最後）にあるので、ここで空けないと帯の下に隠れる（02-9 ⑤） */}
      {rest && <div aria-hidden data-testid="rest-spacer" className="h-[calc(6rem+env(safe-area-inset-bottom))] shrink-0" />}
      {more && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-night/50 p-4 sm:items-center" onClick={() => setMore(false)}>
          <div role="dialog" aria-modal="true" aria-label="ほかの操作" className="w-full max-w-sm space-y-2 rounded-2xl bg-surface p-4" onClick={(e) => e.stopPropagation()}>
            {day === 'today' && (
              <button
                type="button"
                autoFocus
                className={`${SUB_BUTTON} w-full`}
                onClick={() => {
                  setRest({ startedAt: Date.now(), seconds: readRestSeconds() });
                  setMore(false);
                }}
              >
                <Timer aria-hidden className="size-5" />
                {RECORD_MESSAGES.restStart}
              </button>
            )}
            {canFilm && (
              <>
                <button
                  type="button"
                  aria-describedby="video-hint"
                  className={`${SUB_BUTTON} w-full`}
                  onClick={() => {
                    setFilming(true);
                    setMore(false);
                  }}
                >
                  <Video aria-hidden className="size-5" />
                  {RECORD_MESSAGES.video}
                </button>
                <p id="video-hint" className="text-center text-note font-bold text-fg-muted">
                  {RECORD_MESSAGES.videoHint}
                </p>
              </>
            )}
            <ThickButton tone="white" size="sm" className="w-full" onClick={() => setMore(false)}>
              {RECORD_MESSAGES.closeMore}
            </ThickButton>
          </div>
        </div>
      )}
      {closing && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-night/50 p-4 sm:items-center">
          <div role="alertdialog" aria-modal="true" aria-labelledby="close-title" aria-describedby="close-desc" className="w-full max-w-sm rounded-2xl bg-surface p-5">
            <h2 id="close-title" className="text-xl font-extrabold">
              {RECORD_CLOSE_MESSAGES.title}
            </h2>
            <p id="close-desc" className="mt-2 text-sm text-fg-muted">
              {RECORD_CLOSE_MESSAGES.body}
            </p>
            <div className="mt-5 flex gap-2">
              <ThickButton autoFocus tone="white" size="sm" className="flex-1" onClick={() => setClosing(false)}>
                {RECORD_CLOSE_MESSAGES.keep}
              </ThickButton>
              <Link href={closeHref} className={buttonClass({ variant: 'primary', size: 'sm' }, 'flex-1')}>
                {RECORD_CLOSE_MESSAGES.close}
              </Link>
            </div>
          </div>
        </div>
      )}
      {filming && recordId && <VideoRecorder recordId={recordId} onClose={closeFilming} />}
    </FullScreen>
  );
}

function Skeleton() {
  return (
    <FullScreen>
      <div aria-busy="true" aria-label="読み込み中" className="space-y-4 px-4 pt-8">
        <div className="h-8 w-40 animate-pulse rounded-lg bg-canvas" />
        <div className="h-40 animate-pulse rounded-fl bg-canvas" />
        <div className="h-24 animate-pulse rounded-fl bg-canvas" />
      </div>
    </FullScreen>
  );
}
