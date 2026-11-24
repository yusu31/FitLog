'use client';

import { useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Plus, Search, Star, X } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMemo, useState, type FormEvent } from 'react';
import { cn } from 'cn';
import { FullScreen } from '@/components/fitlog/full-screen';
import { buttonClass, ThickButton } from '@/components/fitlog/thick-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { messageOf } from '@/lib/api/message';
import {
  getListExercisesQueryKey,
  ListRecordsKind,
  useCreateExercise,
  useListExercises,
  useListRecords,
  BodyPart as BodyPartValue,
  type BodyPart,
  type ExerciseResponse,
} from '@/lib/api/generated';
import { BodyFigure } from '@/components/me/body-figure';
import { BODY_PART_LABEL, BODY_PART_ORDER } from '@/lib/body-parts';
import { exerciseGuide, exerciseHint, exerciseImages } from '@/lib/exercise-info';
import { levelsOf } from '@/lib/heatmap';
import { parseDayMode, withDay, type DayMode } from '@/lib/day-mode';
import { useRequireSession } from '@/lib/use-require-session';

const NAME_MAX = 30;

// はじめての人向けに先頭へ固定する種目（A01-9）。部位が散らばるよう、胸・脚・背中・腹から1〜2つずつ。この順で並べ、一覧に無い名前は飛ばす
const STARTER_NAMES = ['腕立て伏せ', 'スクワット', 'ダンベルプレス', 'ラットプルダウン', 'クランチ'];

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
  // 部位で絞る（E3）。null は「すべて」
  const [part, setPart] = useState<BodyPart | null>(null);
  // 最近やった種目（E2）。今日の画面と同じ条件の一覧なので、キャッシュを共有する
  const workouts = useListRecords({ kind: ListRecordsKind.workout, limit: '5' }, { query: { enabled: signedIn } });
  // 部位の見出しの開け閉め（L10）。最初はすべて閉じる。検索中と部位を選んだときは、見出しを押さなくても開く
  const [openParts, setOpenParts] = useState<ReadonlySet<BodyPart>>(new Set());
  const togglePart = (p: BodyPart) =>
    setOpenParts((cur) => {
      const next = new Set(cur);
      if (!next.delete(p)) next.add(p);
      return next;
    });
  const [adding, setAdding] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [added, setAdded] = useState<string | null>(null);

  const exercises = data?.status === 200 ? data.data : undefined;
  const q = normalize(query);
  const forceOpen = q !== '' || part !== null;
  const groups = useMemo(() => {
    const matched = (exercises ?? []).filter((e) => normalize(e.name).includes(q) && (part === null || e.bodyPart === part));
    return BODY_PART_ORDER.map((part) => ({ part, items: matched.filter((e) => e.bodyPart === part) })).filter((g) => g.items.length > 0);
  }, [exercises, q, part]);

  // 新しい記録から、重複なしで最大5つ。探している間（検索・部位で絞り中）は出さない
  const recent = useMemo(() => {
    if (!exercises || q || part !== null || workouts.data?.status !== 200) return [];
    const ids: string[] = [];
    for (const r of workouts.data.data.items) for (const ex of r.exercises ?? []) if (!ids.includes(ex.exerciseId)) ids.push(ex.exerciseId);
    return ids.flatMap((id) => exercises.find((e) => e.id === id) ?? []).slice(0, 5);
  }, [exercises, q, part, workouts.data]);

  // 一覧を絞っていない間だけ、先頭に出す（探している種目の邪魔にしない）
  const starters = useMemo(() => {
    if (!exercises || q || part !== null) return [];
    return STARTER_NAMES.flatMap((name) => exercises.find((e) => e.name === name && !e.isCustom) ?? []);
  }, [exercises, q, part]);

  // 自分の記録が1件でもあるか。無いうちは、お試しの数字を自分の数字に見せない（A01-11）
  const hasRecords = workouts.data?.status === 200 && workouts.data.data.items.length > 0;

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
          href={withDay('/today', day)}
          aria-label="とじる"
          className={buttonClass({ variant: 'icon' }, '[&_svg]:size-7')}
        >
          <X aria-hidden className="size-6" />
        </Link>
        <h1 className="text-page-title font-extrabold">種目を選ぶ</h1>
      </header>

      <div className="px-4 pt-2">
        <div className="relative">
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-fg-subtle" />
          <Input
            type="search"
            aria-label="種目を さがす"
            placeholder="種目を さがす"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-12 rounded-fl border-2 border-line bg-canvas pl-11 text-base font-bold text-fg placeholder:text-fg-muted"
          />
        </div>
      </div>

      {/* 体の図で部位を選ぶ（D3-1）。押すと、下の部位のチップと同じ絞り込みになる。もう一度押すと「すべて」 */}
      <div className="mx-4 mt-3 flex justify-center gap-6 rounded-fl bg-surface py-2 shadow-soft">
        {(['front', 'back'] as const).map((view) => (
          <BodyFigure
            key={view}
            view={view}
            size={84}
            levels={levelsOf(part ? [{ bodyPart: part, sets: 99 }] : [])}
            onPick={(p) => setPart((cur) => (cur === p ? null : p))}
          />
        ))}
      </div>

      <div role="group" aria-label="部位で絞る" className="flex flex-wrap gap-2 px-4 pt-3 pb-1">
        {[{ value: null, label: 'すべて' }, ...BODY_PART_ORDER.map((p) => ({ value: p, label: BODY_PART_LABEL[p] }))].map((o) => (
          <button
            key={o.label}
            type="button"
            aria-pressed={part === o.value}
            aria-label={o.value === null ? o.label : `${o.label}で絞る`}
            onClick={() => setPart(o.value)}
            className={cn(
              'min-h-11 shrink-0 rounded-full border-2 px-4 text-sm font-extrabold outline-none focus-visible:ring-4 focus-visible:ring-teal/40',
              part === o.value ? 'border-teal-dark bg-teal-dark text-white' : 'border-line bg-surface text-fg-muted',
            )}
          >
            {o.label}
          </button>
        ))}
      </div>

      <div role="status" aria-live="polite" className="px-4">
        {added && <p className="mt-3 rounded-fl bg-teal-light px-4 py-3 text-sm font-extrabold text-fg">「{added}」を 追加したよ</p>}
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
            <div key={i} className="h-14 animate-pulse rounded-fl bg-canvas" />
          ))}
        </div>
      ) : isError || !exercises ? (
        <p role="alert" className="mx-4 mt-4 rounded-fl bg-coral-light px-4 py-3 text-sm font-bold text-fg">
          読み込めませんでした。電波の良い所で開き直してください
        </p>
      ) : groups.length === 0 ? (
        <div className="px-4 pt-6 text-center">
          <p className="font-bold text-fg-muted">
            {q ? `「${query.trim()}」は 見つかりませんでした` : '種目が まだありません'}
          </p>
          <p className="mt-1 text-sm text-fg-subtle">ないときは、自分用に追加できます。</p>
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
        <div className="space-y-1">
          {starters.length > 0 && (
            <section aria-labelledby="starter-exercises">
              <h2 id="starter-exercises" className="px-4 pt-4 pb-2 text-note font-bold tracking-widest text-fg-subtle">
                はじめての人向け
              </h2>
              <ul className="flex flex-col gap-2 px-4">
                {starters.map((e) => (
                  <li key={e.id}>
                    <ExerciseRow exercise={e} day={day} showTrial={hasRecords} />
                  </li>
                ))}
              </ul>
            </section>
          )}
          {recent.length > 0 && (
            <section aria-labelledby="recent-exercises">
              <h2 id="recent-exercises" className="px-4 pt-4 pb-2 text-note font-bold tracking-widest text-fg-subtle">
                最近やった種目
              </h2>
              <ul className="flex flex-col gap-2 px-4">
                {recent.map((e) => (
                  <li key={e.id}>
                    <ExerciseRow exercise={e} day={day} showTrial={hasRecords} />
                  </li>
                ))}
              </ul>
            </section>
          )}
          {groups.map(({ part: p, items }) => {
            const expanded = forceOpen || openParts.has(p);
            return (
              <section key={p} aria-labelledby={`part-${p}`}>
                <h2 id={`part-${p}`} className="pt-1">
                  <button
                    type="button"
                    aria-expanded={expanded}
                    aria-controls={`part-list-${p}`}
                    onClick={() => togglePart(p)}
                    className="flex min-h-11 w-full items-center gap-2 px-4 text-left text-note font-bold tracking-widest text-fg-subtle outline-none focus-visible:ring-4 focus-visible:ring-teal/40"
                  >
                    <PartIcon part={p} />
                    <span>{BODY_PART_LABEL[p]}</span>
                    <span aria-hidden className="font-sans tracking-normal">
                      {items.length}
                    </span>
                    <ChevronDown aria-hidden className={cn('ml-auto size-5 transition-transform motion-reduce:transition-none', expanded && 'rotate-180')} />
                  </button>
                </h2>
                {expanded && (
                  <ul id={`part-list-${p}`} className="flex flex-col gap-2 px-4 pb-2">
                    {items.map((e) => (
                      <li key={e.id}>
                        <ExerciseRow exercise={e} day={day} showTrial={hasRecords} />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
          {/* 下に固定の「種目を追加」が最後の行に重ならないよう、固定ボタンの高さ分の余白 */}
          <div aria-hidden data-testid="footer-spacer" className="h-24" />
        </div>
      )}
    </FullScreen>
  );
}

function ExerciseRow({ exercise, day, showTrial }: { exercise: ExerciseResponse; day: DayMode; showTrial: boolean }) {
  const { id, name, bodyPart, isCustom, trialWeightKg, trialReps } = exercise;
  const hint = exerciseHint(exercise);
  const images = exerciseImages(exercise);
  const guide = exerciseGuide(exercise);
  const [open, setOpen] = useState(false);
  return (
    <div>
    <div className="flex items-stretch gap-1.5">
    <Link
      href={withDay(`/record?exercise=${encodeURIComponent(id)}`, day)}
      className={cn(
        'fl-slab flex min-h-14 min-w-0 flex-1 items-center gap-3 py-1.5 pr-3 pl-2.5 outline-none',
        'transition-transform active:translate-y-0.5 focus-visible:ring-4 focus-visible:ring-teal/40 motion-reduce:transition-none',
      )}
    >
      <span aria-hidden className="flex size-[34px] shrink-0 items-center justify-center rounded-full bg-teal-light">
        <PartIcon part={bodyPart} />
      </span>
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block truncate font-extrabold">{name}</span>
        {hint && <span className="mt-0.5 line-clamp-2 block text-note font-bold text-fg-muted">{hint}</span>}
        {isCustom && <span className="fl-tag mt-0.5 bg-gold !py-0 !text-note !leading-4 text-fg">じぶんの</span>}
      </span>
      {showTrial && trialWeightKg !== null && trialReps !== null && (
        <span className="flex shrink-0 flex-col items-end leading-tight">
          <span className="text-note font-bold text-fg-muted">目安</span>
          {/* 0kg は「0kg × 10」ではなく「自重 × 10」（L5） */}
          <span className="fl-num text-lg text-fg">
            {trialWeightKg === 0 ? (
              <>
                自重
                <small className="mx-0.5 font-sans text-note font-bold not-italic text-fg-subtle">×</small>
              </>
            ) : (
              <>
                {trialWeightKg}
                <small className="mx-0.5 font-sans text-note font-bold not-italic text-fg-subtle">kg ×</small>
              </>
            )}
            {trialReps}
          </span>
        </span>
      )}
      <ChevronRight aria-hidden className="size-5 shrink-0 text-fg-subtle" />
    </Link>
    {(images || guide) && (
      <button
        type="button"
        aria-expanded={open}
        aria-label={`${name}のやり方を${open ? '閉じる' : '見る'}`}
        onClick={() => setOpen((v) => !v)}
        className="fl-slab flex w-12 shrink-0 items-center justify-center text-note font-extrabold text-brand outline-none focus-visible:ring-4 focus-visible:ring-teal/40"
      >
        {open ? '閉じる' : 'やり方'}
      </button>
    )}
    </div>
    {open && (images || guide) && (
      <div className="mt-1.5 space-y-2.5 rounded-fl bg-surface p-3 shadow-soft">
        {images && <ExercisePhotos name={name} images={images} />}
        {guide && (
          <>
            {(guide.muscles.length > 0 || guide.difficulty !== null) && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                {guide.muscles.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-note font-bold text-fg-subtle">鍛える筋肉</span>
                    {guide.muscles.map((m) => (
                      <span key={m} className="rounded-full bg-teal-light px-2.5 py-0.5 text-note font-extrabold text-brand">
                        {m}
                      </span>
                    ))}
                  </div>
                )}
                {guide.difficulty !== null && (
                  <div className="flex items-center gap-1" role="img" aria-label={`むずかしさ ${guide.difficulty} / 3`}>
                    <span aria-hidden className="text-note font-bold text-fg-subtle">
                      むずかしさ
                    </span>
                    {[1, 2, 3].map((n) => (
                      <Star key={n} aria-hidden className={cn('size-4', n <= guide.difficulty! ? 'fill-gold text-gold' : 'text-line')} />
                    ))}
                  </div>
                )}
              </div>
            )}
            {guide.steps.length > 0 && (
              <ol className="list-decimal space-y-1 pl-5 text-sm font-bold text-fg">
                {guide.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            )}
          </>
        )}
      </div>
    )}
    </div>
  );
}

// 開始と終了の姿勢を、1.8秒ごとに入れ替えて見せる（動きの確認）。動きを減らす設定では、2枚を横に並べる
function ExercisePhotos({ name, images }: { name: string; images: [string, string] }) {
  const cls = 'aspect-[4/3] w-full rounded-xl bg-teal-light object-cover';
  return (
    <div className="relative aspect-[4/3] motion-reduce:grid motion-reduce:aspect-auto motion-reduce:grid-cols-2 motion-reduce:gap-1.5">
      {images.map((src, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={src}
          src={src}
          alt={`${name} ${i === 0 ? '開始' : '終了'}の姿勢`}
          loading="lazy"
          className={cn(cls, i === 1 && 'fl-flip absolute inset-0 motion-reduce:static')}
        />
      ))}
    </div>
  );
}

// 部位の小さな体の図（D3-4）。前から見える部位は前、背中とお尻は後ろ。文字は横に別にあるので、読み上げからは外す
const BACK_VIEW_PARTS: ReadonlySet<BodyPart> = new Set([BodyPartValue.back, BodyPartValue.glutes]);
function PartIcon({ part }: { part: BodyPart }) {
  return <BodyFigure decorative view={BACK_VIEW_PARTS.has(part) ? 'back' : 'front'} size={15} levels={levelsOf([{ bodyPart: part, sets: 99 }])} />;
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
        <p className="text-note text-fg-subtle">{NAME_MAX}字まで。同じ名前は重ねて作れません。</p>
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
                bodyPart === part ? 'border-teal-dark bg-teal-dark text-white' : 'border-line bg-surface text-fg',
              )}
            >
              {BODY_PART_LABEL[part]}
            </button>
          ))}
        </div>
      </fieldset>

      {error && (
        <p role="alert" className="rounded-fl bg-coral-light px-3 py-2 text-sm font-bold text-fg">
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
