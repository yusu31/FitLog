'use client';

import { useQueryClient } from '@tanstack/react-query';
import { ChevronDown } from 'lucide-react';
import { cn } from 'cn';
import { useState } from 'react';
import { WeightRuler } from '@/components/body/weight-ruler';
import { ThickButton } from '@/components/fitlog/thick-button';
import { getGetBodyQueryKey, useGetBody, useSetWeight, type BodyResponse } from '@/lib/api/generated';
import { messageOf } from '@/lib/api/message';
import { BODY_MESSAGES, clampWeight, startingWeight } from '@/lib/body/body';
import { toLocalDate } from '@/lib/shared/local-date';
import { toUnit } from '@/lib/unit';
import { useWeightUnit } from '@/lib/use-preferences';

// 記録タブの「今日の体重」の帯（02-9 PR 1）。たたんだ状態は1行（入っていれば値・まだなら「入れる」）、押すと定規と保存が開く。
// 体重は本人だけに見える。判定の言葉は出さない
export function WeightBand() {
  const body = useGetBody();
  const data = body.data?.status === 200 ? body.data.data : null;
  if (!data) return null; // 読み込み中・失敗のときは帯ごと出さない（記録タブの主役ではない）
  return <Band data={data} />;
}

function Band({ data }: { data: BodyResponse }) {
  const today = toLocalDate(new Date());
  const todayKg = data.weights.find((w) => w.date === today)?.kg;
  const unit = useWeightUnit();
  const [open, setOpen] = useState(false);
  const [weight, setWeightValue] = useState(startingWeight(todayKg, data.latest?.kg, data.heightCm));
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const queryClient = useQueryClient();
  const setWeight = useSetWeight();

  async function save() {
    setNotice(null);
    try {
      const res = await setWeight.mutateAsync({ date: today, data: { kg: weight } });
      if (res.status !== 200) return setNotice({ ok: false, text: messageOf(res.data, BODY_MESSAGES.saveFailed) });
      await queryClient.invalidateQueries({ queryKey: getGetBodyQueryKey() });
      setNotice({ ok: true, text: BODY_MESSAGES.saved });
    } catch {
      setNotice({ ok: false, text: BODY_MESSAGES.saveFailed });
    }
  }

  return (
    <section aria-labelledby="weight-band" className="fl-slab px-4 py-2">
      <h2 id="weight-band">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="flex min-h-11 w-full items-center justify-between gap-2 rounded-lg text-left outline-none focus-visible:ring-4 focus-visible:ring-teal/40"
        >
          <span className="text-sm font-extrabold">
            {todayKg === undefined ? (
              '今日の体重を入れる'
            ) : (
              <>
                今日の体重 <span className="fl-num text-lg">{toUnit(todayKg, unit).toFixed(1)}</span>
                <small className="text-[0.7em] font-bold">{unit}</small>
              </>
            )}
          </span>
          <ChevronDown aria-hidden className={cn('size-5 shrink-0 text-brand', open && 'rotate-180')} />
        </button>
      </h2>
      {open && (
        <div className="space-y-2 pt-1">
          <p aria-live="polite" className="text-center font-extrabold">
            <span className="fl-num text-5xl leading-none">{toUnit(weight, unit).toFixed(1)}</span>
            <span className="ml-1 text-lg text-fg-muted">{unit}</span>
          </p>
          <WeightRuler value={weight} unit={unit} onChange={(kg) => setWeightValue(clampWeight(kg))} />
          <ThickButton type="button" size="sm" className="w-full" disabled={setWeight.isPending} onClick={save}>
            {setWeight.isPending ? BODY_MESSAGES.saving : BODY_MESSAGES.save}
          </ThickButton>
          {notice && (
            <p role={notice.ok ? 'status' : 'alert'} className="text-sm font-bold text-fg">
              {notice.text}
            </p>
          )}
          <p className="text-center text-note font-bold text-fg-muted">自分だけに見えます</p>
        </div>
      )}
    </section>
  );
}
