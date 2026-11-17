'use client';

import { Check, Footprints, Moon, Plus, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from 'cn';
import { Sprite } from '@/components/fitlog/sprite';
import { SyncBanner } from '@/components/fitlog/sync-banner';
import { ThickButton } from '@/components/fitlog/thick-button';
import { sendErrorText } from '@/lib/api/api-error';
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
import { formatSet } from '@/lib/format';
import { HOME_MESSAGES, LATE_MESSAGES, REST_MESSAGES, WORKOUT_END_MESSAGES } from '@/lib/messages';
import { toLocalDate } from '@/lib/shared/local-date';
import { todayPose } from '@/lib/today-pose';
import { buildMenu, type MenuItem, type TodayMenu } from '@/lib/today-menu';
import { shouldWelcomeBack } from '@/lib/welcome-back';
import { RoutineStarter } from '@/components/routine/routine-starter';
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
        <div className="h-[128px] animate-pulse bg-face" />
        <div className="mx-4 mt-4 h-44 animate-pulse rounded-fl bg-face" />
        <div className="mx-4 mt-4 h-16 animate-pulse rounded-fl bg-face" />
      </div>
    );
  }

  const days: WeekDay[] = week.data?.status === 200 ? week.data.data.days : [];
  const todayStatus = days.find((d) => d.date === today)?.status ?? 'none';
  const items = workouts.data?.status === 200 ? workouts.data.data.items : null;
  const lastDate = latest.data?.status === 200 ? (latest.data.data.items[0]?.localDate ?? null) : null;
  const welcomeBack = shouldWelcomeBack(lastDate, today);
  const menu = items ? buildMenu(items, dayDateOf(day, new Date())) : null;

  return (
    <>
      <h1 className="sr-only">きょう</h1>
      {days.length === 7 ? (
        <WeekStrip days={days} today={today} />
      ) : (
        <p role="alert" className="m-4 rounded-fl bg-coral-light px-4 py-3 text-sm font-bold text-ink">
          {LOAD_ERROR}
        </p>
      )}
      <SyncBanner />

      <div className="space-y-4 px-4 pt-4">
        <DaySwitch day={day} onChange={setDay} />
        {day === 'yesterday' && (
          <p className="rounded-fl bg-gold-light px-4 py-2 text-center text-sm font-extrabold text-ink">{LATE_MESSAGES.banner}</p>
        )}
        {day === 'today' && welcomeBack && (
          <p className="flex items-center gap-2 rounded-fl bg-teal-light px-4 py-3 text-sm font-extrabold text-ink">
            <Sparkles aria-hidden className="size-5 shrink-0 text-teal-dark" />
            {HOME_MESSAGES.welcomeBack}
          </p>
        )}

        {menu === null ? (
          <p role="alert" className="rounded-fl bg-coral-light px-4 py-3 text-sm font-bold text-ink">
            {LOAD_ERROR}
          </p>
        ) : day === 'yesterday' ? (
          // きのうの分: 次の1枚と休みは出さず、種目を選んで記録する（きのうの休みは作れない）
          menu.items.length > 0 ? (
            <Menu items={menu.items} day={day} />
          ) : (
            <LinkButton href={withDay('/exercises', day)}>種目を選ぶ</LinkButton>
          )
        ) : (
          <>
            {/* キャラは次の1枚の右上に立つ（足が少しカードに重なる）。飾りなので読み上げない */}
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
            {menu.items.length > 0 && <Menu items={menu.items} day={day} />}
          </>
        )}

        {todayStatus !== 'rest' && <RoutineStarter day={day} />}
        <RunLink day={day} />
        {/* 休みの日はおやすみの札、記録した日は「休む」と矛盾するので、どちらも出さない（N5） */}
        {day === 'today' && todayStatus === 'none' && <RestButton />}
      </div>
      {finished && <WorkoutSummary finished={finished} onClose={() => setFinished(null)} />}
    </>
  );
}

// 「今日 / きのう」の切り替え（F-21）。きのうの分を、あとから記録するときに使う
function DaySwitch({ day, onChange }: { day: DayMode; onChange: (next: DayMode) => void }) {
  const options: { value: DayMode; label: string }[] = [
    { value: 'today', label: LATE_MESSAGES.today },
    { value: 'yesterday', label: LATE_MESSAGES.yesterday },
  ];
  return (
    <div role="group" aria-label={LATE_MESSAGES.switchLabel} className="flex gap-1 rounded-fl bg-face p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={day === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'min-h-11 flex-1 rounded-lg text-[15px] font-extrabold outline-none focus-visible:ring-4 focus-visible:ring-teal/40',
            day === o.value ? 'bg-white text-ink shadow-sm' : 'text-sub-strong',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

type Session = NonNullable<TodayMenu['session']>;
type Finished = { exerciseCount: number; setCount: number; bestCount: number };

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
      await endWorkout.mutateAsync({ id: session.recordId });
      onEnded({ exerciseCount: session.exerciseCount, setCount: session.setCount, bestCount: bestCountOf(session.recordId) });
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
      <LinkButton href={next ? recordHref(next.exerciseId) : '/exercises'}>{WORKOUT_END_MESSAGES.keepGoing}</LinkButton>
      <ThickButton tone="white" className="mt-3" disabled={!online || sending} onClick={onEnd}>
        {WORKOUT_END_MESSAGES.end}
      </ThickButton>
      {!online && <p className="mt-2 text-xs font-bold">{WORKOUT_END_MESSAGES.offlineNote}</p>}
      {error && (
        <p role="alert" className="mt-2 rounded-lg bg-coral-light px-3 py-2 text-sm font-bold text-ink">
          {error}
        </p>
      )}
    </CardFrame>
  );
}

// 終了のまとめ（N1）。大きい祝福はここだけに置き、セットごとの結果シートは小さいままにする（U1）。
// 自己ベストの回数は、この画面を開いている間に数えた分だけ（読み直したあとは 0 に戻り、出さない）
function WorkoutSummary({ finished, onClose }: { finished: Finished; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div aria-hidden onClick={onClose} className="absolute inset-0 bg-ink/50" />
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
        {finished.bestCount > 0 && <p className="text-base font-extrabold text-teal-dark">{WORKOUT_END_MESSAGES.best(finished.bestCount)}</p>}
        <ThickButton autoFocus onClick={onClose}>
          {WORKOUT_END_MESSAGES.close}
        </ThickButton>
      </div>
    </div>
  );
}

// 次の1枚（ティールの大きいカード）。状態で中身が変わる
function NextCard({ menu, todayStatus }: { menu: TodayMenu; todayStatus: string }) {
  if (todayStatus === 'rest') {
    return (
      <CardFrame label="次の1枚" tone="grape" tag="REST">
        <h2 className="mt-3 text-2xl leading-snug font-extrabold">今日は おやすみ</h2>
        <p className="mt-1 text-sm leading-relaxed font-bold">休むのも、立派な記録です。また 気が向いたら 一緒に。</p>
      </CardFrame>
    );
  }
  if (menu.allDone) {
    return (
      <CardFrame label="次の1枚" tone="teal" tag="DONE">
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
    <CardFrame label="次の1枚" tone="teal" tag="NEXT">
      <h2 className="mt-2.5 text-[30px] leading-[1.15] font-extrabold">{item.name}</h2>
      {item.previous && (
        <p className="mt-2 flex items-baseline gap-2">
          <span className="text-xs font-extrabold">前回</span>
          <span className="fl-num text-5xl leading-none">{formatSet(item.previous)}</span>
        </p>
      )}
      {item.suggestion && (
        <p className="mt-2 flex items-baseline gap-2">
          <span className="text-xs font-extrabold">今日の目標</span>
          <span className="fl-num text-2xl leading-none">{formatSet(item.suggestion)}</span>
        </p>
      )}
      <LinkButton href={recordHref(item.exerciseId)}>はじめる</LinkButton>
    </CardFrame>
  );
}

// 初回（前回の筋トレなし）: 種目を選ぶ。お試しの前回値を灰色の札つきで見せる
function FirstCard() {
  const exercises = useListExercises();
  const trial = exercises.data?.data.find((e) => e.trialWeightKg !== null && e.trialReps !== null);
  return (
    <CardFrame label="次の1枚" tone="teal" tag="NEXT">
      <h2 className="mt-3 text-2xl leading-snug font-extrabold">最初の種目を選ぼう</h2>
      {trial && trial.trialWeightKg !== null && trial.trialReps !== null && (
        <div className="mt-3 rounded-lg bg-black/15 px-3 py-2">
          <p className="flex items-center gap-2">
            <span className="fl-tag bg-line text-sub-strong">お試し</span>
            <span className="text-sm font-extrabold">{trial.name}</span>
          </p>
          <p className="fl-num mt-1 text-3xl">{formatSet({ weightKg: trial.trialWeightKg, reps: trial.trialReps })}</p>
          <p className="mt-0.5 text-xs font-bold">お試しの値です。1回やると、次から前回の値が出ます。</p>
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
      <span className="fl-tag bg-gold text-ink">{tag}</span>
      {children}
    </section>
  );
}

// ThickButton と同じ見た目の、リンク。ボタンの中にリンクは置けないので別に持つ（gold のみ）
function LinkButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="fl-thick relative mt-4 inline-flex min-h-14 w-full items-center justify-center rounded-fl bg-gold px-5 text-lg font-extrabold tracking-wider text-ink outline-none [--thick:var(--color-gold-dark)] focus-visible:ring-4 focus-visible:ring-white/60"
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
      <h2 className="mb-2 text-sm font-extrabold text-sub-strong">今日のメニュー</h2>
      <ul aria-label="今日のメニュー" className="space-y-2">
        {items.map((item, i) => {
          const value = item.todayLast ?? item.previous;
          return (
            <li key={item.exerciseId}>
              <Link
                href={withDay(recordHref(item.exerciseId), day)}
                className={cn(
                  'fl-slab flex min-h-16 items-center gap-3 px-3 outline-none focus-visible:ring-4 focus-visible:ring-teal/40',
                  item.done && 'bg-face',
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    'fl-num flex size-11 shrink-0 items-center justify-center rounded-full border-2 text-xl',
                    item.done
                      ? 'border-gold bg-gold text-ink shadow-[0_3px_0_var(--color-gold-dark)]'
                      : 'border-line-dark bg-white text-sub-strong',
                  )}
                >
                  {item.done ? <Check className="size-6" strokeWidth={3.2} /> : i + 1}
                </span>
                <span className="min-w-0 flex-1 text-[15px] leading-tight font-extrabold">
                  {item.name}
                  {item.done && <small className="block text-xs font-bold text-sub-strong">できた</small>}
                  {!item.done && item.suggestion && (
                    <small className="block text-xs font-bold text-sub-strong">目標 {formatSet(item.suggestion)}</small>
                  )}
                </span>
                {value && <span className="fl-num shrink-0 text-xl text-ink">{formatSet(value)}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
      <Link
        href={withDay('/exercises', day)}
        className="mt-2 flex min-h-12 items-center justify-center gap-1.5 rounded-fl border-2 border-dashed border-line-dark text-[15px] font-extrabold text-teal-dark outline-none focus-visible:ring-4 focus-visible:ring-teal/40"
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
      <ThickButton tone="white" disabled={sending} onClick={onRest}>
        <Moon aria-hidden />
        今日は休む
      </ThickButton>
      {error && (
        <p role="alert" className="mt-2 rounded-lg bg-coral-light px-3 py-2 text-sm font-bold text-ink">
          {error}
        </p>
      )}
    </div>
  );
}

// ランの記録（S-13）への入口。休みの日でも出す（休みを残したまま、走った日の記録を足せる。UC-13）
function RunLink({ day }: { day: DayMode }) {
  return (
    <Link
      href={withDay('/run', day)}
      className="fl-slab flex min-h-14 items-center justify-center gap-2 px-4 text-base font-extrabold text-teal-dark outline-none focus-visible:ring-4 focus-visible:ring-teal/40"
    >
      <Footprints aria-hidden className="size-5" />
      ランを記録
    </Link>
  );
}
