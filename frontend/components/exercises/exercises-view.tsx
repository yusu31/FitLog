'use client';

import { useQueryClient } from '@tanstack/react-query';
import { ChevronRight, Plus, Search, X } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMemo, useState, type FormEvent } from 'react';
import { cn } from 'cn';
import { FullScreen } from '@/components/fitlog/full-screen';
import { ThickButton } from '@/components/fitlog/thick-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { messageOf } from '@/lib/api/message';
import {
  getListExercisesQueryKey,
  useCreateExercise,
  useListExercises,
  type BodyPart,
  type ExerciseResponse,
} from '@/lib/api/generated';
import { BODY_PART_LABEL, BODY_PART_ORDER } from '@/lib/body-parts';
import { parseDayMode, withDay, type DayMode } from '@/lib/day-mode';
import { useRequireSession } from '@/lib/use-require-session';

const NAME_MAX = 30;

// 検索のための正規化: 前後の空白を除き、大文字小文字をそろえる
const normalize = (text: string) => text.trim().toLowerCase();

// S-11 種目を選ぶ（docs/screen-design.md）。部位つきの一覧・検索・「種目を追加」。
// 選ぶと S-12 記録（/record?exercise=）へ移る。静的書き出しなので、種目の ID はクエリで運ぶ
export function ExercisesView() {
  const { signedIn } = useRequireSession();
  // きのうの分（F-21）から来たときは、選んだ先の記録画面にも引き継ぐ
  const day = parseDayMode(useSearchParams().get('day'));
  const { data, isPending, isError } = useListExercises({ query: { enabled: signedIn } });
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [added, setAdded] = useState<string | null>(null);

  const exercises = data?.status === 200 ? data.data : undefined;
  const q = normalize(query);
  const groups = useMemo(() => {
    const matched = (exercises ?? []).filter((e) => normalize(e.name).includes(q));
    return BODY_PART_ORDER.map((part) => ({ part, items: matched.filter((e) => e.bodyPart === part) })).filter((g) => g.items.length > 0);
  }, [exercises, q]);

  const loading = !signedIn || isPending;

  return (
    <FullScreen
      footer={
        !adding && (
          <ThickButton tone="white" onClick={() => setAdding(true)}>
            <Plus aria-hidden />
            種目を追加
          </ThickButton>
        )
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
        <h1 className="text-[28px] font-extrabold">種目を選ぶ</h1>
      </header>

      <div className="px-4 pt-2">
        <div className="relative">
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-sub" />
          <Input
            type="search"
            aria-label="種目を さがす"
            placeholder="種目を さがす"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-12 rounded-fl border-2 border-line bg-face pl-11 text-base font-bold text-ink placeholder:text-sub-strong"
          />
        </div>
      </div>

      <div role="status" aria-live="polite" className="px-4">
        {added && <p className="mt-3 rounded-fl bg-teal-light px-4 py-3 text-sm font-extrabold text-ink">「{added}」を 追加したよ</p>}
      </div>

      {adding && (
        <AddExerciseForm
          initialName={draftName}
          onCancel={() => setAdding(false)}
          onAdded={(name) => {
            setAdding(false);
            setDraftName('');
            setQuery('');
            setAdded(name);
          }}
        />
      )}

      {loading ? (
        <div aria-busy="true" aria-label="読み込み中" className="space-y-2 px-4 pt-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-fl bg-face" />
          ))}
        </div>
      ) : isError || !exercises ? (
        <p role="alert" className="mx-4 mt-4 rounded-fl bg-coral-light px-4 py-3 text-sm font-bold text-ink">
          読み込めませんでした。電波の良い所で開き直してください
        </p>
      ) : groups.length === 0 ? (
        <div className="px-4 pt-6 text-center">
          <p className="font-bold text-sub-strong">
            {q ? `「${query.trim()}」は 見つかりませんでした` : '種目が まだありません'}
          </p>
          <p className="mt-1 text-sm text-sub">ないときは、自分用に追加できます。</p>
          {q && !adding && (
            <ThickButton
              tone="teal"
              size="sm"
              className="mt-4"
              onClick={() => {
                setDraftName(query.trim());
                setAdding(true);
              }}
            >
              <Plus aria-hidden />「{query.trim()}」を 追加する
            </ThickButton>
          )}
        </div>
      ) : (
        <div className="space-y-1 pb-6">
          {groups.map(({ part, items }) => (
            <section key={part} aria-labelledby={`part-${part}`}>
              <h2 id={`part-${part}`} className="px-4 pt-4 pb-2 text-xs font-bold tracking-widest text-sub">
                {BODY_PART_LABEL[part]}
              </h2>
              <ul className="flex flex-col gap-2 px-4">
                {items.map((e) => (
                  <li key={e.id}>
                    <ExerciseRow exercise={e} day={day} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </FullScreen>
  );
}

function ExerciseRow({ exercise, day }: { exercise: ExerciseResponse; day: DayMode }) {
  const { id, name, bodyPart, isCustom, trialWeightKg, trialReps } = exercise;
  return (
    <Link
      href={withDay(`/record?exercise=${encodeURIComponent(id)}`, day)}
      className={cn(
        'fl-slab flex min-h-14 items-center gap-3 py-1.5 pr-3 pl-2.5 outline-none',
        'transition-transform active:translate-y-0.5 focus-visible:ring-4 focus-visible:ring-teal/40 motion-reduce:transition-none',
      )}
    >
      <span aria-hidden className="flex size-[34px] shrink-0 items-center justify-center rounded-full bg-teal-light text-sm font-extrabold text-teal-deep">
        {BODY_PART_LABEL[bodyPart].slice(0, 1)}
      </span>
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block truncate font-extrabold">{name}</span>
        {isCustom && <span className="fl-tag mt-0.5 bg-gold !py-0 !text-xs !leading-4 text-ink">じぶんの</span>}
      </span>
      {trialWeightKg !== null && trialReps !== null && (
        <span className="fl-num shrink-0 text-lg text-ink">
          {trialWeightKg}
          <small className="mx-0.5 font-sans text-[11px] font-bold not-italic text-sub">kg ×</small>
          {trialReps}
        </span>
      )}
      <ChevronRight aria-hidden className="size-5 shrink-0 text-sub" />
    </Link>
  );
}

function AddExerciseForm({
  initialName,
  onCancel,
  onAdded,
}: {
  initialName: string;
  onCancel: () => void;
  onAdded: (name: string) => void;
}) {
  const queryClient = useQueryClient();
  const createExercise = useCreateExercise();
  const [name, setName] = useState(initialName.slice(0, NAME_MAX));
  const [bodyPart, setBodyPart] = useState<BodyPart | null>(null);
  const [error, setError] = useState<string | null>(null);

  const trimmed = name.trim();
  const canSubmit = trimmed.length > 0 && bodyPart !== null && !createExercise.isPending;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || bodyPart === null) return;
    setError(null);
    try {
      const res = await createExercise.mutateAsync({ data: { name: trimmed, bodyPart } });
      if (res.status === 201) {
        await queryClient.invalidateQueries({ queryKey: getListExercisesQueryKey() });
        onAdded(trimmed);
      } else {
        // 同じ名前（409）など。API の文言（画面に出せる日本語）をそのまま見せる
        setError(messageOf(res.data, '追加できませんでした。もう一度ためしてください'));
      }
    } catch {
      setError('送れませんでした。電波の良い所でもう一度ためしてください');
    }
  }

  return (
    <form onSubmit={onSubmit} className="fl-slab mx-4 mt-3 space-y-4 px-4 py-4">
      <div className="space-y-2">
        <Label htmlFor="exercise-name" className="font-extrabold">
          種目の名前
        </Label>
        <Input
          id="exercise-name"
          value={name}
          maxLength={NAME_MAX}
          onChange={(e) => setName(e.target.value)}
          className="h-12 rounded-fl border-2 text-base font-bold"
        />
        <p className="text-xs text-sub">{NAME_MAX}字まで。同じ名前は重ねて作れません。</p>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-extrabold">きたえる 部位（1つ）</legend>
        <div className="flex flex-wrap gap-2">
          {BODY_PART_ORDER.map((part) => (
            <button
              key={part}
              type="button"
              aria-pressed={bodyPart === part}
              onClick={() => setBodyPart(part)}
              className={cn(
                'min-h-11 min-w-14 rounded-fl border-2 px-3 text-sm font-extrabold outline-none',
                'focus-visible:ring-4 focus-visible:ring-teal/40',
                bodyPart === part ? 'border-teal-dark bg-teal-dark text-white' : 'border-line bg-white text-ink',
              )}
            >
              {BODY_PART_LABEL[part]}
            </button>
          ))}
        </div>
      </fieldset>

      {error && (
        <p role="alert" className="rounded-fl bg-coral-light px-3 py-2 text-sm font-bold text-ink">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <ThickButton tone="white" size="sm" onClick={onCancel}>
          やめる
        </ThickButton>
        <ThickButton type="submit" tone="teal" size="sm" className="flex-1" disabled={!canSubmit}>
          追加する
        </ThickButton>
      </div>
    </form>
  );
}
