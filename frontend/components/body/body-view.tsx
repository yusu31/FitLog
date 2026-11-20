'use client';

import { useQueryClient } from '@tanstack/react-query';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { FullScreen } from '@/components/fitlog/full-screen';
import { ThickButton } from '@/components/fitlog/thick-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  getGetBodyQueryKey,
  useGetBody,
  useGetMyProfile,
  useGetOneRepMax,
  useSetHeight,
  useSetWeight,
  type BodyResponse,
  type OneRepMaxItem,
} from '@/lib/api/generated';
import { messageOf } from '@/lib/api/message';
import { BODY_MESSAGES, formatDelta, parseHeightText, parseWeightText } from '@/lib/body/body';
import { formatMonthDay } from '@/lib/format';
import { toLocalDate } from '@/lib/shared/local-date';
import { useRequireSession } from '@/lib/use-require-session';
import { ProfileForm } from './profile-form';
import { WeightChart } from './weight-chart';

type Notice = { ok: boolean; text: string } | null;

// からだ（B14a。入口は B14b でつなぐ）。体重・身長・BMI・7日平均・グラフ・推定1RM・プロフィール。
// 判定の言葉（肥満・標準など）は出さない。体重と身長は自分だけに見える
export function BodyPage() {
  useRequireSession();
  const body = useGetBody();
  const oneRm = useGetOneRepMax();
  const profile = useGetMyProfile();
  const data = body.data?.status === 200 ? body.data.data : null;
  const items = oneRm.data?.status === 200 ? oneRm.data.data.items : null;
  const mine = profile.data?.status === 200 ? profile.data.data : null;

  return (
    <FullScreen>
      <header className="flex items-center gap-1 px-2 pt-3">
        <Link
          href="/me"
          aria-label={BODY_MESSAGES.back}
          className="flex size-11 items-center justify-center rounded-fl text-fg-muted outline-none focus-visible:ring-4 focus-visible:ring-teal/40"
        >
          <ChevronLeft aria-hidden className="size-7" />
        </Link>
        <h1 className="text-page-title font-extrabold">{BODY_MESSAGES.title}</h1>
      </header>
      <div className="space-y-4 px-4 pt-3 pb-10">
        {data ? (
          <>
            <Inputs data={data} />
            <Numbers data={data} />
            <section aria-labelledby="body-chart" className="fl-slab px-4 py-3">
              <h2 id="body-chart" className="mb-2 text-sm font-extrabold text-fg-muted">
                {BODY_MESSAGES.chartSection}
              </h2>
              <WeightChart points={data.weights} />
            </section>
            <OneRepMaxSection items={items} />
            {mine && (
              <section aria-labelledby="body-profile" className="fl-slab space-y-3 px-4 py-3">
                <h2 id="body-profile" className="text-sm font-extrabold text-fg-muted">
                  {BODY_MESSAGES.profileSection}
                </h2>
                <p className="text-note text-fg-muted">{BODY_MESSAGES.profileHint}</p>
                <ProfileForm initial={mine} />
              </section>
            )}
          </>
        ) : (
          <p className="rounded-lg bg-canvas px-3 py-6 text-center text-sm font-bold text-fg-muted">
            {body.isError || body.data ? BODY_MESSAGES.loadFailed : BODY_MESSAGES.loading}
          </p>
        )}
      </div>
    </FullScreen>
  );
}

// 今日の体重と身長の入力
function Inputs({ data }: { data: BodyResponse }) {
  const queryClient = useQueryClient();
  const setWeight = useSetWeight();
  const setHeight = useSetHeight();
  const today = toLocalDate(new Date());
  const todayKg = data.weights.find((w) => w.date === today)?.kg;
  const [weightText, setWeightText] = useState(todayKg === undefined ? '' : String(todayKg));
  const [heightText, setHeightText] = useState(data.heightCm === null ? '' : String(data.heightCm));
  const [notice, setNotice] = useState<Notice>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    const weight = weightText.trim() === '' ? null : parseWeightText(weightText);
    const height = heightText.trim() === '' ? null : parseHeightText(heightText);
    if (weightText.trim() !== '' && weight === null) return setNotice({ ok: false, text: BODY_MESSAGES.weightInvalid });
    if (heightText.trim() !== '' && height === null) return setNotice({ ok: false, text: BODY_MESSAGES.heightInvalid });
    try {
      if (weight !== null) {
        const res = await setWeight.mutateAsync({ date: today, data: { kg: weight } });
        if (res.status !== 200) return setNotice({ ok: false, text: messageOf(res.data, BODY_MESSAGES.saveFailed) });
      }
      if (height !== data.heightCm) {
        const res = await setHeight.mutateAsync({ data: { heightCm: height } });
        if (res.status !== 200) return setNotice({ ok: false, text: messageOf(res.data, BODY_MESSAGES.saveFailed) });
      }
      await queryClient.invalidateQueries({ queryKey: getGetBodyQueryKey() });
      setNotice({ ok: true, text: BODY_MESSAGES.saved });
    } catch {
      setNotice({ ok: false, text: BODY_MESSAGES.saveFailed });
    }
  }

  const pending = setWeight.isPending || setHeight.isPending;
  return (
    <form onSubmit={onSubmit} aria-labelledby="body-inputs" className="fl-slab space-y-3 px-4 py-3">
      <h2 id="body-inputs" className="text-sm font-extrabold text-fg-muted">
        {BODY_MESSAGES.weightSection}
      </h2>
      <div className="space-y-2">
        <Label htmlFor="body-weight" className="font-extrabold">
          {BODY_MESSAGES.weightLabel}
        </Label>
        <Input id="body-weight" inputMode="decimal" value={weightText} onChange={(e) => setWeightText(e.target.value)} className="h-11 bg-surface" />
        <p className="text-note text-fg-muted">{BODY_MESSAGES.weightHint}</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="body-height" className="font-extrabold">
          {BODY_MESSAGES.heightLabel}
        </Label>
        <Input id="body-height" inputMode="decimal" value={heightText} onChange={(e) => setHeightText(e.target.value)} className="h-11 bg-surface" />
        <p className="text-note text-fg-muted">{BODY_MESSAGES.heightHint}</p>
      </div>
      <ThickButton type="submit" size="sm" className="w-full" disabled={pending}>
        {pending ? BODY_MESSAGES.saving : BODY_MESSAGES.save}
      </ThickButton>
      {notice && (
        <p role={notice.ok ? 'status' : 'alert'} className="text-sm font-bold text-fg">
          {notice.text}
        </p>
      )}
      <p className="text-note text-fg-muted">{BODY_MESSAGES.onlyYou}</p>
    </form>
  );
}

// BMI・7日平均・前回からの増減。数字だけで、判定の言葉は出さない
function Numbers({ data }: { data: BodyResponse }) {
  return (
    <section aria-labelledby="body-numbers" className="fl-slab px-4 py-3">
      <h2 id="body-numbers" className="text-sm font-extrabold text-fg-muted">
        {BODY_MESSAGES.numbersSection}
      </h2>
      <dl className="mt-2 grid grid-cols-3 gap-2 text-center">
        <div>
          <dt className="text-note font-bold text-fg-muted">{BODY_MESSAGES.bmi}</dt>
          <dd className="text-xl font-extrabold">{data.bmi ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-note font-bold text-fg-muted">{BODY_MESSAGES.avg7}</dt>
          <dd className="text-xl font-extrabold">{data.avg7 === null ? '—' : `${data.avg7}kg`}</dd>
        </div>
        <div>
          <dt className="text-note font-bold text-fg-muted">{BODY_MESSAGES.delta}</dt>
          <dd className="text-xl font-extrabold">{formatDelta(data.deltaFromPrevious)}</dd>
        </div>
      </dl>
      {data.bmi === null && <p className="mt-2 text-note text-fg-muted">{BODY_MESSAGES.bmiNeed}</p>}
    </section>
  );
}

function OneRepMaxSection({ items }: { items: OneRepMaxItem[] | null }) {
  return (
    <section aria-labelledby="body-onerm" className="fl-slab px-4 py-3">
      <h2 id="body-onerm" className="text-sm font-extrabold text-fg-muted">
        {BODY_MESSAGES.oneRmSection}
      </h2>
      <p className="mt-1 text-note text-fg-muted">{BODY_MESSAGES.oneRmHint}</p>
      {items && items.length > 0 ? (
        <ul className="mt-2 divide-y divide-line">
          {items.map((i) => (
            <li key={i.exerciseId} className="flex items-baseline justify-between gap-2 py-2">
              <span className="font-bold">{i.name}</span>
              <span className="text-right">
                <span className="text-lg font-extrabold">{i.kg}kg</span>
                {i.approximate && (
                  <span title={BODY_MESSAGES.oneRmApproxHint} className="ml-1 rounded-full bg-gold px-2 py-0.5 text-note font-extrabold">
                    {BODY_MESSAGES.oneRmApprox}
                  </span>
                )}
                <span className="block text-note text-fg-muted">
                  {i.weightKg}kg × {i.reps}回（{formatMonthDay(i.date)}）
                </span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm font-bold text-fg-muted">{BODY_MESSAGES.oneRmEmpty}</p>
      )}
    </section>
  );
}
