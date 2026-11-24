'use client';

import { useQueryClient } from '@tanstack/react-query';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { FullScreen } from '@/components/fitlog/full-screen';
import { buttonClass, ThickButton } from '@/components/fitlog/thick-button';
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
import { BMI_SCALE, BODY_MESSAGES, bmiBarLabel, bmiPercent, clampWeight, formatDelta, guessWeight, heightFrom, parseHeightText, rulerPrev } from '@/lib/body/body';
import { formatMonthDay } from '@/lib/format';
import { toUnit } from '@/lib/unit';
import { useWeightUnit } from '@/lib/use-preferences';
import { toLocalDate } from '@/lib/shared/local-date';
import { useRequireSession } from '@/lib/use-require-session';
import { ProfileForm } from './profile-form';
import { WeightChart } from './weight-chart';
import { WeightRuler } from './weight-ruler';
import { InfoTip } from '@/components/fitlog/info-tip';

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
          className={buttonClass({ variant: 'icon' }, '[&_svg]:size-7')}
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
                <InfoTip
                  label="プロフィールの説明"
                  heading={
                    <h2 id="body-profile" className="text-sm font-extrabold text-fg-muted">
                      {BODY_MESSAGES.profileSection}
                    </h2>
                  }
                >
                  {BODY_MESSAGES.profileHint}
                </InfoTip>
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
  const last = data.latest;
  // ルーラーは、今日の体重 → 前回の体重 → 60kg の順で始める。動かさず前回の値のまま保存してもよい
  // 記録が無い人は、身長があれば身長から目安（BMI 22）、無ければ 60kg
  const guessed = todayKg === undefined && !last && data.heightCm !== null;
  const [weight, setWeightValue] = useState(todayKg ?? last?.kg ?? guessWeight(data.heightCm));
  const unit = useWeightUnit();
  const [touched, setTouched] = useState(false);
  const [heightText, setHeightText] = useState(data.heightCm === null ? '' : String(data.heightCm));
  const [notice, setNotice] = useState<Notice>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    const height = heightText.trim() === '' ? null : parseHeightText(heightText);
    if (heightText.trim() !== '' && height === null) return setNotice({ ok: false, text: BODY_MESSAGES.heightInvalid });
    try {
      if (touched || last !== null) {
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
      {/* 使い方は「?」にまとめ、画面には1行だけ（D0-2） */}
      <InfoTip
        label="体重の入れ方"
        heading={
          <h2 id="body-inputs" className="text-sm font-extrabold text-fg-muted">
            {BODY_MESSAGES.weightSection}
          </h2>
        }
      >
        {BODY_MESSAGES.rulerHint}。{BODY_MESSAGES.weightHint}
      </InfoTip>
      <p aria-live="polite" className="text-center font-extrabold">
        <span className="fl-num text-6xl leading-none">{toUnit(weight, unit).toFixed(1)}</span>
        <span className="ml-1 text-xl text-fg-muted">{unit}</span>
      </p>
      <p className="text-center text-note font-bold text-fg-muted">
        {last ? rulerPrev(toUnit(last.kg, unit), formatMonthDay(last.date), unit) : guessed && data.heightCm !== null ? BODY_MESSAGES.rulerGuess(data.heightCm) : BODY_MESSAGES.rulerFirst}
      </p>
      <WeightRuler
        value={weight}
        unit={unit}
        onChange={(kg) => {
          setTouched(true);
          setWeightValue(clampWeight(kg));
        }}
      />
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
      {data.bmi === null ? <p className="mt-2 text-note text-fg-muted">{BODY_MESSAGES.bmiNeed}</p> : <BmiBand bmi={data.bmi} heightCm={data.heightCm} />}
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

// BMI の帯。色の区間と 18.5・25・30 の目盛りだけで、自分の位置に印を置く。判定の言葉は出さない
function BmiBand({ bmi, heightCm }: { bmi: number; heightCm: number | null }) {
  const at = (v: number) => `${bmiPercent(v)}%`;
  const [a, b, c] = BMI_SCALE.marks;
  const gradient = `linear-gradient(90deg, #8fc5e8 0 ${at(a)}, #7ccf9a ${at(a)} ${at(b)}, #ffd36b ${at(b)} ${at(c)}, #ff9a8a ${at(c)})`;
  return (
    <div className="mt-3">
      <div role="img" aria-label={bmiBarLabel(bmi)} className="relative h-2 rounded" style={{ background: gradient }}>
        <i className="absolute -top-1 h-4 w-1 -translate-x-1/2 rounded-sm bg-fg" style={{ left: at(bmi) }} />
      </div>
      <div aria-hidden className="relative mt-1 h-3 text-note font-bold text-fg-muted">
        {BMI_SCALE.marks.map((m) => (
          <span key={m} className="absolute -translate-x-1/2" style={{ left: at(m) }}>
            {m}
          </span>
        ))}
      </div>
      {heightCm !== null && <p className="mt-1 text-note text-fg-muted">{heightFrom(heightCm)}</p>}
    </div>
  );
}
