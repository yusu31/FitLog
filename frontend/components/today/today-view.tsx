'use client';

import { Check, Moon, Sparkles } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from 'cn';
import { ThickButton } from '@/components/fitlog/thick-button';
import {
  ListRecordsKind,
  useGetWeek,
  useListExercises,
  useListRecords,
  type WeekDay,
} from '@/lib/api/generated';
import { formatSet } from '@/lib/format';
import { HOME_MESSAGES } from '@/lib/messages';
import { toLocalDate } from '@/lib/shared/local-date';
import { buildMenu, type MenuItem, type TodayMenu } from '@/lib/today-menu';
import { shouldWelcomeBack } from '@/lib/welcome-back';
import { WeekStrip } from './week-strip';

const LOAD_ERROR = '読み込めませんでした。電波の良い所で開き直してください';

const recordHref = (exerciseId: string) => `/record?exercise=${encodeURIComponent(exerciseId)}`;

// S-10 今日（docs/screen-design.md 4章）。読み取り専用。
// 「今日は休む」「送信待ちの帯」は書き込みの土台ができてから（次の PR）なので、見た目だけ置く。
export function TodayView() {
  // 日付は日本時間。端末のタイムゾーンを使わない（T-DATE-11）
  const today = toLocalDate(new Date());
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
  const menu = items ? buildMenu(items, today) : null;

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

      <div className="space-y-4 px-4 pt-4">
        {welcomeBack && (
          <p className="flex items-center gap-2 rounded-fl bg-teal-light px-4 py-3 text-sm font-extrabold text-ink">
            <Sparkles aria-hidden className="size-5 shrink-0 text-teal-dark" />
            {HOME_MESSAGES.welcomeBack}
          </p>
        )}

        {menu === null ? (
          <p role="alert" className="rounded-fl bg-coral-light px-4 py-3 text-sm font-bold text-ink">
            {LOAD_ERROR}
          </p>
        ) : (
          <>
            <NextCard menu={menu} todayStatus={todayStatus} />
            {menu.items.length > 0 && <Menu items={menu.items} />}
          </>
        )}

        {todayStatus !== 'rest' && <RestButton />}
      </div>
    </>
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
      <h2 className="mt-3 text-2xl leading-snug font-extrabold">{item.name}</h2>
      {item.previous && (
        <p className="mt-2 flex items-baseline gap-2">
          <span className="text-xs font-extrabold">前回</span>
          <span className="fl-num text-3xl">{formatSet(item.previous)}</span>
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

// 今日のメニュー: 前回と同じ種目が同じ順で並ぶ。できた種目は黄のチェック
function Menu({ items }: { items: MenuItem[] }) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-extrabold text-sub-strong">ほかの種目（今日のメニュー）</h2>
      <ul aria-label="今日のメニュー" className="space-y-2">
        {items.map((item, i) => {
          const value = item.todayLast ?? item.previous;
          return (
            <li key={item.exerciseId}>
              <Link
                href={recordHref(item.exerciseId)}
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
                </span>
                {value && <span className="fl-num shrink-0 text-xl text-ink">{formatSet(value)}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// 「今日は休む」: 見た目だけ。押したときの処理（休みの記録を書く）は書き込みの土台ができてから。
function RestButton() {
  return (
    <div>
      <ThickButton tone="white" disabled>
        <Moon aria-hidden />
        今日は休む
      </ThickButton>
      <p className="mt-2 text-center text-xs text-sub">もうすぐ使えるようになります</p>
    </div>
  );
}
