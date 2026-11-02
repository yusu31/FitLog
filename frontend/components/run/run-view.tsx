'use client';

import { Check, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
import { cn } from 'cn';
import { FullScreen } from '@/components/fitlog/full-screen';
import { ThickButton } from '@/components/fitlog/thick-button';
import { sendErrorText } from '@/lib/api/api-error';
import { RUN_MESSAGES, runSavedMessage } from '@/lib/messages';
import { useRecordMutations } from '@/lib/mutations';
import {
  formatPace,
  kmToMeters,
  minSecToSeconds,
  paceSecPerKm,
  parseKm,
  parseWholeNumber,
  validateRun,
  type RunError,
} from '@/lib/run';
import { useOnline } from '@/lib/use-browser-state';
import { useRequireSession } from '@/lib/use-require-session';

type Saved = { distanceM: number; durationS: number };

// 入力（文字）を、API に送る値（m・秒の整数）にする。読めない欄があれば NaN が入り、validateRun が弾く
function toRun(kmText: string, minText: string, secText: string) {
  const seconds = parseWholeNumber(secText);
  // 秒は 0〜59 の欄。60 以上は「分に直してね」の意味で範囲の外にする（画面と API の「1分〜24時間」を正しく守るため）
  const durationS = seconds > 59 ? NaN : minSecToSeconds(parseWholeNumber(minText), seconds);
  return { distanceM: kmToMeters(parseKm(kmText)), durationS };
}

// S-13 記録（ラン）（docs/screen-design.md 1章・features.md 2.4 UC-09）。
// 距離（km）と時間（分・秒）を入れて保存する。ペース（分/km）は画面が計算して見せる（DB には持たない）。
// GPX の取り込み・地図は、このあとの PR で足す（範囲外）
export function RunView() {
  const { signedIn } = useRequireSession();
  const router = useRouter();
  const online = useOnline();
  const { createRecord } = useRecordMutations();

  const [kmText, setKmText] = useState('');
  const [minText, setMinText] = useState('');
  const [secText, setSecText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<Saved | null>(null);

  const { distanceM, durationS } = toRun(kmText, minText, secText);
  const problem: RunError | null = validateRun(distanceM, durationS);
  const touched = kmText.trim() !== '' || minText.trim() !== '' || secText.trim() !== '';
  // 範囲の説明は、その欄に何か入れたあとだけ出す（まっさらなうちは責めない）
  const distanceProblem = kmText.trim() !== '' && validateRun(distanceM, 60) === 'distance';
  const durationProblem = (minText.trim() !== '' || secText.trim() !== '') && validateRun(100, durationS) === 'duration';
  const pace = problem === null ? paceSecPerKm(distanceM, durationS) : null;

  async function onSave() {
    if (sending || problem !== null) return;
    setError(null);
    const data = {
      id: crypto.randomUUID(),
      kind: 'run' as const,
      run: { distanceM, durationS },
      recordedAt: new Date().toISOString(),
    };
    if (!online) {
      // 電波が無いときは、送信待ちに入れて待たずに結果を出す（F-30）
      createRecord.mutate({ data });
      setSaved({ distanceM, durationS });
      return;
    }
    setSending(true);
    try {
      await createRecord.mutateAsync({ data });
      setSaved({ distanceM, durationS });
    } catch (e) {
      setError(sendErrorText(e, RUN_MESSAGES.sendError));
    } finally {
      setSending(false);
    }
  }

  if (!signedIn) return <Skeleton />;

  if (saved) {
    const savedPace = paceSecPerKm(saved.distanceM, saved.durationS);
    return (
      <FullScreen
        footer={
          <ThickButton onClick={() => router.push('/today')} autoFocus>
            今日へ
          </ThickButton>
        }
      >
        <div className="flex flex-1 flex-col justify-center gap-4 px-4 pb-8">
          <section
            role="status"
            className="fl-stripes relative overflow-hidden rounded-fl bg-teal-dark px-[18px] pt-3.5 pb-5 text-white shadow-[0_4px_0_var(--color-teal-deep)] [--stripe:rgb(0_0_0/0.14)]"
          >
            <span className="fl-tag bg-gold text-ink">RUN</span>
            <p className="mt-3 flex items-center gap-2 text-2xl leading-snug font-extrabold">
              <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gold text-ink">
                <Check className="size-5" strokeWidth={3.2} />
              </span>
              {RUN_MESSAGES.saved}
            </p>
            <p className="mt-2 text-sm leading-relaxed font-bold">{runSavedMessage(saved.distanceM, saved.durationS)}</p>
            <p className="mt-3 flex items-baseline gap-2">
              <span className="text-xs font-extrabold">ペース</span>
              <span data-testid="pace" className="fl-num text-3xl">
                {savedPace === null ? '--' : formatPace(savedPace)}
              </span>
            </p>
          </section>
        </div>
      </FullScreen>
    );
  }

  return (
    <FullScreen
      footer={
        <ThickButton onClick={onSave} disabled={problem !== null || sending}>
          保存する
        </ThickButton>
      }
    >
      <header className="flex items-center gap-1 px-2 pt-3">
        <Link
          href="/today"
          aria-label="とじる"
          className="flex size-11 items-center justify-center rounded-fl text-sub-strong outline-none focus-visible:ring-4 focus-visible:ring-teal/40"
        >
          <X aria-hidden className="size-6" />
        </Link>
      </header>

      <div className="flex flex-1 flex-col gap-5 px-4 pt-2 pb-8">
        <h1 className="text-[32px] leading-tight font-extrabold">ラン</h1>

        <NumberField
          label="距離（km）"
          unit="km"
          inputMode="decimal"
          value={kmText}
          onChange={setKmText}
          placeholder="5.2"
          invalid={distanceProblem}
          big
        />
        {distanceProblem && <Hint>{RUN_MESSAGES.distanceRange}</Hint>}

        <div>
          <p className="mb-2 text-sm font-extrabold text-sub-strong">時間</p>
          <div className="flex items-end gap-3">
            <NumberField label="時間（分）" unit="分" inputMode="numeric" value={minText} onChange={setMinText} placeholder="32" invalid={durationProblem} />
            <NumberField label="時間（秒）" unit="秒" inputMode="numeric" value={secText} onChange={setSecText} placeholder="10" invalid={durationProblem} />
          </div>
          {durationProblem && <Hint>{RUN_MESSAGES.durationRange}</Hint>}
        </div>

        <section aria-label="ペース" className="fl-slab flex items-baseline justify-between px-4 py-3">
          <span className="text-sm font-extrabold text-sub-strong">ペース（1kmあたり）</span>
          <span data-testid="pace" className={cn('fl-num text-3xl', pace === null ? 'text-sub' : 'text-teal-dark')}>
            {pace === null ? '--' : formatPace(pace)}
          </span>
        </section>
        {!touched && <p className="text-xs font-bold text-sub-strong">距離と時間を入れると、ペースが出ます</p>}

        {error && (
          <p role="alert" className="rounded-fl bg-coral-light px-4 py-3 text-sm font-bold text-ink">
            {error}
          </p>
        )}
      </div>
    </FullScreen>
  );
}

function Hint({ children }: { children: string }) {
  return <p className="-mt-3 text-sm font-bold text-ink">{children}</p>;
}

// 大きな数字の入力欄。文字として受け、読み取りと範囲の検査は lib/run.ts に任せる（打っている途中の「5.」なども壊さない）
function NumberField({
  label,
  unit,
  value,
  onChange,
  inputMode,
  placeholder,
  invalid,
  big = false,
}: {
  label: string;
  unit: string;
  value: string;
  onChange: (next: string) => void;
  inputMode: 'decimal' | 'numeric';
  placeholder: string;
  invalid: boolean;
  big?: boolean;
}) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className={cn(
        'fl-slab flex min-w-0 items-baseline gap-2 px-4 py-3 focus-within:border-teal',
        big ? 'w-full' : 'flex-1',
        invalid && 'border-coral',
      )}
    >
      <input
        id={id}
        type="text"
        inputMode={inputMode}
        aria-label={label}
        aria-invalid={invalid || undefined}
        autoComplete="off"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'fl-num min-w-0 flex-1 bg-transparent leading-none text-ink outline-none placeholder:text-line-dark',
          big ? 'text-[56px]' : 'text-[44px]',
        )}
      />
      <span className="shrink-0 text-xl font-extrabold text-sub-strong">{unit}</span>
    </label>
  );
}

function Skeleton() {
  return (
    <FullScreen>
      <div aria-busy="true" aria-label="読み込み中" className="space-y-4 px-4 pt-8">
        <div className="h-8 w-24 animate-pulse rounded-lg bg-face" />
        <div className="h-24 animate-pulse rounded-fl bg-face" />
        <div className="h-24 animate-pulse rounded-fl bg-face" />
      </div>
    </FullScreen>
  );
}
