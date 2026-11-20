'use client';

import { Check, ChevronRight, Footprints, Moon, Plus, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from 'cn';
import { Sprite } from '@/components/fitlog/sprite';
import { SyncBanner } from '@/components/fitlog/sync-banner';
import { ThickButton } from '@/components/fitlog/thick-button';
import { sendErrorText } from '@/lib/api/api-error';
import { getRecord, type RecordedExercise } from '@/lib/api/generated';
import { bestCountOf, endCurrentWorkout } from '@/lib/current-workout';
import { useRecordMutations } from '@/lib/mutations';
import { useOnline } from '@/lib/use-browser-state';
import {
  ListRecordsKind,
  useGetWeek,
  useListExercises,
  useListRecords,
  type WeekDay,
} from '@/lib/api/generated';
import { dayDateOf, withDay, type DayMode } from '@/lib/day-mode';
import { WEEKDAYS, formatSet, formatWeight, weekdayIndex } from '@/lib/format';
import { HOME_MESSAGES, LATE_MESSAGES, REST_MESSAGES, WORKOUT_END_MESSAGES } from '@/lib/messages';
import { toLocalDate } from '@/lib/shared/local-date';
import { todayPose } from '@/lib/today-pose';
import { buildMenu, type MenuItem, type TodayMenu } from '@/lib/today-menu';
import { shouldWelcomeBack } from '@/lib/welcome-back';
import { RoutineStarter } from '@/components/routine/routine-starter';
import { FriendsToday } from './friends-today';
import { WeekStrip } from './week-strip';

const LOAD_ERROR = '読み込めませんでした。電波の良い所で開き直してください';

const recordHref = (exerciseId: string) => `/record?exercise=${encodeURIComponent(exerciseId)}`;

// S-10 今日（docs/screen-design.md 4章）。読み取り専用。
// 「送信待ちの帯」は端末への保存（02-4）のあとに足す。
export function TodayView() {
  // 日付は日本時間。端末のタイムゾーンを使わない（T-DATE-11）
  const today = toLocalDate(new Date());
  // 記録する日（F-21 あとから記録）。きのうを選ぶと、記録・ラン・種目一覧のリンクに day=yesterday が付く
  const [day, setDay] = useState<DayMode>('today');
  // 「今日はここまで」を押したあとのまとめ（N1）。記録中の札が消えても、閉じるまで出し続ける
  const [finished, setFinished] = useState<Finished | null>(null);
  const week = useGetWeek({ date: today });
  // 今日の分（今日の日付の記録）と前回（それより前の一番新しい記録）の両方を取るため、少し多めに読む
  const workouts = useListRecords({ kind: ListRecordsKind.workout, limit: '5' });
  // 休みも数えた最後の記録（おかえりの判定用）
  const latest = useListRecords({ limit: '1' });

  if (week.isPending || workouts.isPending) {
    return (
      <div aria-busy="true" aria-label="読み込み中">
        <h1 className="sr-only">きょう</h1>
        <div className="h-[128px] animate-pulse bg-canvas" />
        <div className="mx-4 mt-4 h-44 animate-pulse rounded-fl bg-canvas" />
        <div className="mx-4 mt-4 h-16 animate-pulse rounded-fl bg-canvas" />
      </div>
    );
  }

  const days: WeekDay[] = week.data?.status === 200 ? week.data.data.days : [];
  const todayStatus = days.find((d) => d.date === today)?.status ?? 'none';
  const items = workouts.data?.status === 200 ? workouts.data.data.items : null;
  const lastDate = latest.data?.status === 200 ? (latest.data.data.items[0]?.localDate ?? null) : null;
  const welcomeBack = shouldWelcomeBack(lastDate, today);
  const menu = items ? buildMenu(items, dayDateOf(day, new Date())) : null;
  const yesterday = dayDateOf('yesterday', new Date());
  const selected = dayDateOf(day, new Date());
  // 7マスを押して日を選ぶ（D2-2・D2-7）。押せるのは今日ときのうだけ（あとから記録はきのうまで。F-21）
  const onSelectDate = (date: string) => setDay(date === yesterday ? 'yesterday' : 'today');
  // 月曜は、きのう（日曜）が前の週で7マスに無い。そのときだけ帯の下に小さい入口を置く
  const yesterdayInStrip = days.some((d) => d.date === yesterday);

  return (
    <>
      <h1 className="sr-only">きょう</h1>
      {days.length === 7 ? (
        <WeekStrip days={days} today={today} selected={selected} selectable={[today, yesterday]} onSelect={onSelectDate} />
      ) : (
        <p role="alert" className="m-4 rounded-fl bg-coral-light px-4 py-3 text-sm font-bold text-fg">
          {LOAD_ERROR}
        </p>
      )}
      <SyncBanner />

      <div className="space-y-4 px-4 pt-4 pb-6">
        {/* 仲間の今日の足跡（A02-1）。グループが無いときは招待の入口（A01-8）。きのうの画面では出さない */}
        {day === 'today' && <FriendsToday today={today} part="summary" />}
        {!yesterdayInStrip && days.length === 7 && <YesterdayOutsideWeek day={day} onChange={setDay} />}
        <DayHeading date={selected} day={day} />
        {/* ランの入口は上部に（A07-1）。休みの日でも出す（記録すると、その日の休みは消える。D2-6） */}
        <RunLink day={day} />
        {day === 'today' && welcomeBack && (
          <p className="flex items-center gap-2 rounded-fl bg-teal-light px-4 py-3 text-sm font-extrabold text-fg">
            <Sparkles aria-hidden className="size-5 shrink-0 text-brand" />
            {HOME_MESSAGES.welcomeBack}
          </p>
        )}

        {menu === null ? (
          <p role="alert" className="rounded-fl bg-coral-light px-4 py-3 text-sm font-bold text-fg">
            {LOAD_ERROR}
          </p>
        ) : day === 'yesterday' ? (
          // きのうの分: つぎにやることと休みは出さず、種目を選んで記録する（きのうの休みは作れない）
          menu.items.length > 0 ? (
            <>
              <Menu items={menu.items} day={day} />
              <RoutineStarter day={day} />
            </>
          ) : (
            <>
              <LinkButton href={withDay('/exercises', day)}>種目を選ぶ</LinkButton>
              <RoutineStarter day={day} />
            </>
          )
        ) : (
          <>
            {/* キャラはつぎにやることの右上に立つ（足が少しカードに重なる）。飾りなので読み上げない */}
            <div className="relative z-10 -mb-7 flex justify-end pr-3">
              <Sprite
                pose={todayPose({ restToday: todayStatus === 'rest', allDone: menu.allDone, welcomeBack, now: new Date() })}
                size={112}
              />
            </div>
            {menu.session && todayStatus !== 'rest' ? (
              <ActiveCard session={menu.session} next={menu.next} onEnded={setFinished} />
            ) : (
              <NextCard menu={menu} todayStatus={todayStatus} />
            )}
            {/* 入口は上から「前回と同じで始める」→ ほかの始めかた（いつものメニュー）の順（A02-2） */}
            {todayStatus !== 'rest' && <RoutineStarter day={day} />}
            {menu.items.length > 0 && <Menu items={menu.items} day={day} />}
          </>
        )}

        {/* 休みの日はおやすみの札、記録した日は「休む」と矛盾するので、どちらも出さない（N5） */}
        {day === 'today' && todayStatus === 'none' && <RestButton />}
        {/* 招待の入口は主ボタンより下（P5 N1。上に置くと、6日ぶりの日に主ボタンが最初の画面の外に出る） */}
        {day === 'today' && <FriendsToday today={today} part="invite" />}
      </div>
      {finished && <WorkoutSummary finished={finished} onClose={() => setFinished(null)} />}
    </>
  );
}

// 選んだ日の見出し（A02-7・D2-2）。「今日 11月4日（水）」の1つだけ。きのうは「あとから記録」の札を添える。
// 日の切り替えは上の7マス（今日・きのうのマスが押せる）
function DayHeading({ date, day }: { date: string; day: DayMode }) {
  const label = `${Number(date.slice(5, 7))}月${Number(date.slice(8, 10))}日（${WEEKDAYS[weekdayIndex(date)]}）`;
  return (
    <div className="flex items-center gap-2">
      <h2 className="text-lg font-extrabold">
        {day === 'today' ? LATE_MESSAGES.today : LATE_MESSAGES.yesterday} <span className="text-fg-muted">{label}</span>
      </h2>
      {day === 'yesterday' && <span className="fl-tag bg-gold-light text-fg">{LATE_MESSAGES.tag}</span>}
    </div>
  );
}

// 月曜だけの、きのう（前の週の日曜）への入口。7マスに無い日を選べるようにする小さいボタン
function YesterdayOutsideWeek({ day, onChange }: { day: DayMode; onChange: (next: DayMode) => void }) {
  const toYesterday = day === 'today';
  return (
    <button
      type="button"
      onClick={() => onChange(toYesterday ? 'yesterday' : 'today')}
      className="flex min-h-11 items-center px-1 text-sm font-extrabold text-brand underline underline-offset-4 outline-none focus-visible:ring-4 focus-visible:ring-teal/40"
    >
      {toYesterday ? LATE_MESSAGES.toYesterday : LATE_MESSAGES.toToday}
    </button>
  );
}

type Session = NonNullable<TodayMenu['session']>;
type Finished = { exerciseCount: number; setCount: number; bestCount: number; exercises: RecordedExercise[] };

// 記録中のカード（N1）。開始は自動（最初の「できた」）なので、ここで出すのは「続ける」と「今日はここまで」だけ。
// 終了は電波があるときだけ（サーバーに終了時刻を残すため）。送れなかったときは記録中のまま、やさしい文言を出す
function ActiveCard({ session, next, onEnded }: { session: Session; next: MenuItem | null; onEnded: (f: Finished) => void }) {
  const online = useOnline();
  const { endWorkout } = useRecordMutations();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onEnd() {
    if (sending) return;
    setError(null);
    setSending(true);
    try {
      // まとめの「セット一覧」用に、終える前の記録を取る。取れなくても、まとめ（種目数・セット数）は出す
      const detail = await getRecord(session.recordId).catch(() => null);
      const exercises = detail && detail.status === 200 ? (detail.data.exercises ?? []) : [];
      await endWorkout.mutateAsync({ id: session.recordId });
      onEnded({ exerciseCount: session.exerciseCount, setCount: session.setCount, bestCount: bestCountOf(session.recordId), exercises });
      endCurrentWorkout();
    } catch (e) {
      setError(sendErrorText(e, WORKOUT_END_MESSAGES.sendError));
    } finally {
      setSending(false);
    }
  }

  return (
    <CardFrame label={WORKOUT_END_MESSAGES.active} tone="teal" tag={WORKOUT_END_MESSAGES.tag}>
      <h2 className="mt-3 text-2xl leading-snug font-extrabold">{WORKOUT_END_MESSAGES.active}</h2>
      <p className="fl-num mt-1 text-lg">{WORKOUT_END_MESSAGES.count(session.exerciseCount, session.setCount)}</p>
      {next && <p className="mt-1 text-sm font-bold">次は {next.name}</p>}
      {/* まだの種目が無ければ、最後に記録した種目のセット入力へ（種目の一覧へ戻さない。D2-4） */}
      <LinkButton href={next ? recordHref(next.exerciseId) : session.lastExerciseId ? recordHref(session.lastExerciseId) : '/exercises'}>
        {WORKOUT_END_MESSAGES.keepGoing}
      </LinkButton>
      {/* 主は「続ける」。「今日はここまで」は小さい副のボタン（A02-3） */}
      <div className="mt-3 flex justify-center">
        <ThickButton tone="white" size="sm" disabled={!online || sending} onClick={onEnd}>
          {WORKOUT_END_MESSAGES.end}
        </ThickButton>
      </div>
      {!online && <p className="mt-2 text-note font-bold">{WORKOUT_END_MESSAGES.offlineNote}</p>}
      {error && (
        <p role="alert" className="mt-2 rounded-lg bg-coral-light px-3 py-2 text-sm font-bold text-fg">
          {error}
        </p>
      )}
    </CardFrame>
  );
}

// 終了のまとめ（N1）。大きい祝福はここだけに置き、セットごとの結果シートは小さいままにする（U1）。
// 自己ベストの回数は、この画面を開いている間に数えた分だけ（読み直したあとは 0 に戻り、出さない）
function WorkoutSummary({ finished, onClose }: { finished: Finished; onClose: () => void }) {
  // 総重量（kg）。自重（0kg）のセットは足さない
  const total = finished.exercises.reduce((sum, e) => sum + e.sets.reduce((a, s) => a + s.weightKg * s.reps, 0), 0);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div aria-hidden onClick={onClose} className="absolute inset-0 bg-night/50" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={WORKOUT_END_MESSAGES.summaryTitle}
        className="fl-slab relative m-4 w-full max-w-[398px] space-y-3 px-5 pt-6 pb-5 text-center shadow-lg"
      >
        <div className="flex justify-center">
          <Sprite pose={finished.bestCount > 0 ? 'pb' : 'cheer'} size={144} />
        </div>
        <h2 className="text-2xl font-extrabold">{WORKOUT_END_MESSAGES.thanks}</h2>
        <p className="fl-num text-3xl">{WORKOUT_END_MESSAGES.count(finished.exerciseCount, finished.setCount)}</p>
        {finished.bestCount > 0 && <p className="text-base font-extrabold text-brand">{WORKOUT_END_MESSAGES.best(finished.bestCount)}</p>}
        {total > 0 && (
          <p data-testid="total-weight" className="text-sm font-extrabold text-fg-muted">
            {WORKOUT_END_MESSAGES.total(formatWeight(total))}
          </p>
        )}
        {finished.exercises.length > 0 && (
          <ul aria-label="やったセット" className="max-h-48 space-y-2 overflow-y-auto rounded-fl bg-canvas px-4 py-3 text-left">
            {finished.exercises.map((e) => (
              <li key={e.exerciseId}>
                <p className="text-sm font-extrabold">{e.name}</p>
                <p className="fl-num text-note text-fg-muted">{e.sets.map((s) => formatSet(s)).join('　')}</p>
              </li>
            ))}
          </ul>
        )}
        <ThickButton autoFocus onClick={onClose}>
          {WORKOUT_END_MESSAGES.close}
        </ThickButton>
      </div>
    </div>
  );
}

// つぎにやること（ティールの大きいカード）。状態で中身が変わる
function NextCard({ menu, todayStatus }: { menu: TodayMenu; todayStatus: string }) {
  if (todayStatus === 'rest') {
    return (
      <CardFrame label="つぎにやること" tone="grape" tag="おやすみ">
        <h2 className="mt-3 text-2xl leading-snug font-extrabold">今日は おやすみ</h2>
        <p className="mt-1 text-sm leading-relaxed font-bold">休むのも、立派な記録です。また 気が向いたら 一緒に。</p>
        <Link
          href="/exercises"
          className="mt-3 inline-flex min-h-11 items-center text-sm font-extrabold text-white underline underline-offset-4 outline-none focus-visible:ring-4 focus-visible:ring-surface/60"
        >
          {REST_MESSAGES.changeMind}
        </Link>
      </CardFrame>
    );
  }
  if (menu.allDone) {
    return (
      <CardFrame label="つぎにやること" tone="teal" tag="おわり">
        <h2 className="mt-3 text-2xl leading-snug font-extrabold">今日の分は できた</h2>
        <p className="mt-1 text-sm leading-relaxed font-bold">おつかれさま。もう1セット足したいときは、下のメニューから。</p>
      </CardFrame>
    );
  }
  if (menu.isFirstTime || !menu.next) return <FirstCard />;
  return <NextExercise item={menu.next} />;
}

function NextExercise({ item }: { item: MenuItem }) {
  return (
    <CardFrame label="つぎにやること" tone="teal" tag="つぎ">
      <h2 className="mt-2.5 text-[30px] leading-[1.15] font-extrabold">{item.name}</h2>
      {item.previous && (
        <p className="mt-2 flex items-baseline gap-2">
          <span className="text-note font-extrabold">前回</span>
          <span className="fl-num text-5xl leading-none">{formatSet(item.previous)}</span>
        </p>
      )}
      {item.suggestion && (
        <p className="mt-2 flex items-baseline gap-2">
          <span className="text-note font-extrabold">今日の目標</span>
          <span className="fl-num text-2xl leading-none">{formatSet(item.suggestion)}</span>
        </p>
      )}
      <LinkButton href={recordHref(item.exerciseId)}>{item.previous ? '前回と同じで始める' : 'はじめる'}</LinkButton>
    </CardFrame>
  );
}

// 初回（前回の筋トレなし）: 種目を選ぶ。お試しの前回値を灰色の札つきで見せる
function FirstCard() {
  const exercises = useListExercises();
  const trial = exercises.data?.data.find((e) => e.trialWeightKg !== null && e.trialReps !== null);
  return (
    <CardFrame label="つぎにやること" tone="teal" tag="つぎ">
      <h2 className="mt-3 text-2xl leading-snug font-extrabold">最初の種目を選ぼう</h2>
      {trial && trial.trialWeightKg !== null && trial.trialReps !== null && (
        <div className="mt-3 rounded-lg bg-black/15 px-3 py-2">
          <p className="flex items-center gap-2">
            <span className="fl-tag bg-line text-fg-muted">お試し</span>
            <span className="text-sm font-extrabold">{trial.name}</span>
          </p>
          <p className="fl-num mt-1 text-3xl">{formatSet({ weightKg: trial.trialWeightKg, reps: trial.trialReps })}</p>
          <p className="mt-0.5 text-note font-bold">お試しの値です。1回やると、次から前回の値が出ます。</p>
        </div>
      )}
      <LinkButton href="/exercises">種目を選ぶ</LinkButton>
    </CardFrame>
  );
}

const cardTones = {
  teal: 'bg-teal-dark shadow-[0_4px_0_var(--color-teal-deep)]',
  grape: 'bg-grape-dark shadow-[0_4px_0_#4b3ba8]',
} as const;

function CardFrame({ label, tone, tag, children }: { label: string; tone: keyof typeof cardTones; tag: string; children: ReactNode }) {
  return (
    <section
      aria-label={label}
      className={cn(
        'fl-stripes relative overflow-hidden rounded-fl px-[18px] pt-3.5 pb-4 text-white [--stripe:rgb(0_0_0/0.14)]',
        cardTones[tone],
      )}
    >
      <span className="fl-tag bg-gold text-fg">{tag}</span>
      {children}
    </section>
  );
}

// ThickButton と同じ見た目の、リンク。ボタンの中にリンクは置けないので別に持つ（gold のみ）
function LinkButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="fl-thick relative mt-4 inline-flex min-h-14 w-full items-center justify-center rounded-fl bg-gold px-5 text-lg font-extrabold tracking-wider text-fg outline-none [--thick:var(--color-gold-dark)] focus-visible:ring-4 focus-visible:ring-surface/60"
    >
      {children}
    </Link>
  );
}

// 今日のメニュー: 前回と同じ種目が同じ順で並ぶ。できた種目は黄のチェック。
// 下の「種目を足す」から一覧（S-11）で選んだ種目は、記録すると末尾に並ぶ（buildMenu）。外す・並べ替えは未実装
function Menu({ items, day }: { items: MenuItem[]; day: DayMode }) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-extrabold text-fg-muted">今日のメニュー</h2>
      <ul aria-label="今日のメニュー" className="space-y-2">
        {items.map((item, i) => {
          const value = item.todayLast ?? item.previous;
          return (
            <li key={item.exerciseId}>
              <Link
                href={withDay(recordHref(item.exerciseId), day)}
                className={cn(
                  'fl-slab flex min-h-16 items-center gap-3 px-3 outline-none focus-visible:ring-4 focus-visible:ring-teal/40',
                  item.done && 'bg-canvas',
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    'fl-num flex size-11 shrink-0 items-center justify-center rounded-full border-2 text-xl',
                    item.done
                      ? 'border-gold bg-gold text-fg shadow-[0_3px_0_var(--color-gold-dark)]'
                      : 'border-line-dark bg-surface text-fg-muted',
                  )}
                >
                  {item.done ? <Check className="size-6" strokeWidth={3.2} /> : i + 1}
                </span>
                <span className="min-w-0 flex-1 text-[15px] leading-tight font-extrabold">
                  {item.name}
                  {item.done && <small className="block text-note font-bold text-fg-muted">できた</small>}
                  {!item.done && item.suggestion && (
                    <small className="block text-note font-bold text-fg-muted">目標 {formatSet(item.suggestion)}</small>
                  )}
                </span>
                {value && <span className="fl-num shrink-0 text-xl text-fg">{formatSet(value)}</span>}
                <ChevronRight data-testid="row-arrow" aria-hidden className="size-5 shrink-0 text-fg-muted" />
              </Link>
            </li>
          );
        })}
      </ul>
      <Link
        href={withDay('/exercises', day)}
        className="mt-2 flex min-h-12 items-center justify-center gap-1.5 rounded-fl border-2 border-dashed border-line-dark text-[15px] font-extrabold text-brand outline-none focus-visible:ring-4 focus-visible:ring-teal/40"
      >
        <Plus aria-hidden className="size-5" strokeWidth={3} />
        種目を足す
      </Link>
    </section>
  );
}

// 「今日は休む」（UC-13）: 押すと kind=rest の記録を作り、S-14 おやすみへ移る。
// 休みは1日1件で、2回目以降はサーバーが 200 で既存を返す（どちらも成功として扱う）。
// 電波があるときは、送れたのを確かめてから移る（送れなかったのに「休んだ」画面へ行かないため）。
// 電波が無いときは、F-30 の形で、送信待ちに入れて待たずに移る（電波が戻ったら送られる）
function RestButton() {
  const router = useRouter();
  const online = useOnline();
  const { createRecord } = useRecordMutations();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 送れずに再送待ちになったら（failureCount>0）、待たずに休みの画面へ移る（送信待ちの帯が知らせる）
  const queuedNow = sending && createRecord.failureCount > 0;
  const moved = useRef(false);
  useEffect(() => {
    if (queuedNow && !moved.current) {
      moved.current = true;
      router.push('/rest');
    }
  }, [queuedNow, router]);

  async function onRest() {
    if (sending) return;
    setError(null);
    const data = { id: crypto.randomUUID(), kind: 'rest' as const, recordedAt: new Date().toISOString() };
    if (!online) {
      createRecord.mutate({ data });
      router.push('/rest');
      return;
    }
    setSending(true);
    moved.current = false;
    try {
      await createRecord.mutateAsync({ data });
      if (!moved.current) router.push('/rest');
    } catch (e) {
      if (!moved.current) setError(sendErrorText(e, REST_MESSAGES.sendError));
      setSending(false);
    }
  }

  return (
    <div>
      {/* 休むは目立たせない文字リンクの見た目（A02-4）。押せば休みの記録を作り、/rest で「やっぱり記録する」を選べる */}
      <button
        type="button"
        disabled={sending}
        onClick={onRest}
        className="mx-auto flex min-h-11 items-center gap-1.5 px-3 text-sm font-extrabold text-fg-muted underline underline-offset-4 outline-none focus-visible:ring-4 focus-visible:ring-teal/40 disabled:opacity-60"
      >
        <Moon aria-hidden className="size-4" />
        今日は休む
      </button>
      {error && (
        <p role="alert" className="mt-2 rounded-lg bg-coral-light px-3 py-2 text-sm font-bold text-fg">
          {error}
        </p>
      )}
    </div>
  );
}

// ランの記録（S-13）への入口（上部に置く小さめのリンク。A07-1）
function RunLink({ day }: { day: DayMode }) {
  return (
    <Link
      href={withDay('/run', day)}
      className="fl-slab flex min-h-12 items-center justify-center gap-2 px-4 text-base font-extrabold text-brand outline-none focus-visible:ring-4 focus-visible:ring-teal/40"
    >
      <Footprints aria-hidden className="size-5" />
      ランを記録
    </Link>
  );
}
