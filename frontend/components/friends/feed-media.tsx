'use client';

import { Lock, Pause, Play } from 'lucide-react';
import { useRef, useState } from 'react';
import { Avatar } from '@/components/fitlog/avatar';
import { BodyFigure } from '@/components/me/body-figure';
import { ShootButton } from '@/components/video-grid/shoot-button';
import { VIDEO_GRID_MESSAGES } from '@/components/video-grid/messages';
import { useGetCurrentGroup, useGetVideosThisWeek, type BodyPart, type FeedItem, type FeedStamp, type FeedTopSet } from '@/lib/api/generated';
import { BODY_PART_LABEL } from '@/lib/body-parts';
import { achievementChips } from '@/lib/feed';
import { formatSet } from '@/lib/format';
import { levelsOf } from '@/lib/heatmap';
import type { WeightUnit } from '@/lib/unit';
import { usePreferences, useWeightUnit } from '@/lib/use-preferences';
import { usePlayableVideoUrl } from '@/lib/video/use-video-url';

// 足跡カードの「写真の面」（BeReal 風。D7-6 PR-2・判断ログ 65）。
// 動画があるときは縦 3:4 の枠を幅いっぱいに出し、角に記録の数字の札、右下に押した人の顔と数を重ねる。動画が無いときは数字の札と反応の行だけ（MediaBadges を単独で使う）。
// 見られるかどうかはここで決めない: 本人はいつでも、仲間は期限の前で、今週自分も撮っているとき（GET /videos/week の unlocked）。
// 見られないときは URL を取りに行かず、ぼかして「1本撮ると見られます」を出す（ルールは API 側の videos.service.ts viewUrl のまま）
export type MediaState = 'open' | 'locked' | 'expired';

// 動画の見え方を決める（純粋な関数）。本人は常に open。仲間は期限が過ぎたら expired、今週撮っていなければ locked
export function mediaState(opts: { isOwn: boolean; visibleUntil: string | undefined; unlocked: boolean; now?: number }): MediaState {
  if (opts.isOwn) return 'open';
  const until = opts.visibleUntil ? Date.parse(opts.visibleUntil) : Number.NaN;
  if (!Number.isNaN(until) && (opts.now ?? Date.now()) >= until) return 'expired';
  return opts.unlocked ? 'open' : 'locked';
}

const FACE_MAX = 3;

export function FeedMedia({ item, isOwn, title }: { item: FeedItem; isOwn: boolean; title: string }) {
  const { data } = useGetVideosThisWeek();
  const unlocked = data?.status === 200 ? data.data.unlocked : false;
  const state = mediaState({ isOwn, visibleUntil: item.videoVisibleUntil, unlocked });
  const label = `${item.author.name}の${title}の動画`;
  return (
    <div data-testid="feed-media" className="relative aspect-[3/4] w-full overflow-hidden rounded-fl bg-canvas">
      {state === 'open' && item.videoId ? <OpenVideo videoId={item.videoId} label={label} /> : <ClosedVideo state={state} label={label} />}
      <div className="absolute right-2 bottom-2">
        <Faces stamps={item.stamps} />
      </div>
    </div>
  );
}

// カードの帯（PR 5）。動画の上のふちに、種目と数字・達成のチップを出す（動画には重ねない。動画があってもなくても同じ帯）。
// 達成のチップは筋トレ・ランだけ（自己ベスト・節目・その日に取ったスタンプ）。休み・投稿は名前だけの細い帯
export function FeedBand({ item, title, detail, thin }: { item: FeedItem; title: string; detail: string; thin: boolean }) {
  const chips = achievementChips(item);
  return (
    <div data-testid="feed-band" className={thin ? 'flex flex-wrap items-center gap-1.5 rounded-xl bg-canvas px-3 py-1.5' : 'flex flex-wrap items-center gap-1.5 rounded-xl bg-canvas px-3 py-2'}>
      <p data-testid="number-badge" className="flex min-w-0 items-baseline gap-1.5 text-fg">
        <span className="truncate text-[15px] font-extrabold">{title}</span>
        {detail ? <span className="fl-num shrink-0 text-sm font-bold">{detail}</span> : null}
      </p>
      {chips.map((chip) => (
        <span key={chip} data-testid="achievement-chip" className="rounded-full bg-teal-light px-2.5 py-0.5 text-note font-extrabold text-brand">
          {chip}
        </span>
      ))}
    </div>
  );
}

// 動画が無いカードの面: 反応の顔と、筋トレなら一番重いセット（写真の面が無いだけで、顔は同じ部品）
export function MediaBadges({ item }: { item: FeedItem }) {
  const unit = useWeightUnit();
  const hasFaces = item.stamps.some((s) => s.by.length > 0);
  if (!hasFaces && !item.topSet) return null;
  return (
    <div className="space-y-2">
      {hasFaces && (
        <div className="flex justify-end">
          <Faces stamps={item.stamps} flat />
        </div>
      )}
      {item.topSet && <TopSet set={item.topSet} parts={item.bodyParts ?? []} unit={unit} />}
    </div>
  );
}

// 動画の無い筋トレのカードの面（D7-6）。一番重いセットを大きな数字で、使った部位を体の図で見せる（文字だけのカードにしない）
function TopSet({ set, parts, unit }: { set: FeedTopSet; parts: readonly BodyPart[]; unit: WeightUnit }) {
  const levels = levelsOf(parts.map((bodyPart) => ({ bodyPart, sets: 4 })));
  return (
    <div data-testid="feed-top-set" className="flex items-center justify-between gap-3 rounded-fl bg-teal-light px-4 py-3">
      <p className="min-w-0">
        <span className="block truncate text-note font-bold text-fg-muted">{set.exerciseName}</span>
        <span className="fl-num block text-4xl leading-tight text-fg">{formatSet(set, unit)}</span>
      </p>
      <span role="img" aria-label={`使った部位: ${parts.map((p) => BODY_PART_LABEL[p]).join('・')}`} className="flex shrink-0 gap-1 rounded-lg bg-surface px-2 py-1.5">
        <BodyFigure view="front" levels={levels} size={32} decorative />
        <BodyFigure view="back" levels={levels} size={32} decorative />
      </span>
    </div>
  );
}

// 押した人の顔と数（右下）。顔は同じグループの人の服の色（グループの一覧から引く。見つからなければ既定の色）
function Faces({ stamps, flat = false }: { stamps: readonly FeedStamp[]; flat?: boolean }) {
  const { data } = useGetCurrentGroup();
  const members = data?.status === 200 ? data.data.members : [];
  const shirtOf = (id: string) => members.find((m) => m.id === id)?.avatar.shirtColor ?? 'navy';
  const seen = new Set<string>();
  const people = stamps.flatMap((s) => s.by).filter((u) => (seen.has(u.id) ? false : (seen.add(u.id), true)));
  if (people.length === 0) return null;
  return (
    <div
      data-testid="reaction-faces"
      role="img"
      aria-label={`${people.length}人が反応`}
      className={flat ? 'flex items-center rounded-full bg-canvas py-1 pr-2.5 pl-1' : 'flex items-center rounded-full bg-black/60 py-1 pr-2.5 pl-1'}
    >
      <span className="flex -space-x-2">
        {people.slice(0, FACE_MAX).map((u) => (
          <Avatar key={u.id} shirtColor={shirtOf(u.id)} size={26} className="ring-2 ring-white" />
        ))}
      </span>
      <span className={flat ? 'fl-num ml-1.5 text-sm text-fg' : 'fl-num ml-1.5 text-sm text-white'}>{people.length}</span>
    </div>
  );
}

// 見られる動画。短い期限の署名付き URL をもらい、先頭の1コマを見せる。タップで再生・止める（音なし・自動再生しない）
function OpenVideo({ videoId, label }: { videoId: string; label: string }) {
  const { data, isPending, failed, onError } = usePlayableVideoUrl(videoId);
  const [playing, setPlaying] = useState(false);
  const ref = useRef<HTMLVideoElement>(null);
  const { autoplayVideo } = usePreferences();
  const src = data?.status === 200 ? data.data.url : undefined;
  const playable = Boolean(src) && !failed;

  function toggle() {
    const el = ref.current;
    if (!el) return;
    if (el.paused) void el.play().catch(onError);
    else el.pause();
  }

  if (isPending) return <div aria-busy="true" aria-label={VIDEO_GRID_MESSAGES.loading} className="absolute inset-0 animate-pulse bg-canvas" />;
  if (!playable) {
    return <p className="absolute inset-0 flex items-center justify-center px-4 text-center text-sm font-bold text-fg-muted">{VIDEO_GRID_MESSAGES.unavailable}</p>;
  }
  return (
    <button type="button" onClick={toggle} aria-label={playing ? `${label}を止める` : `${label}を再生する`} className="absolute inset-0 size-full outline-none focus-visible:ring-4 focus-visible:ring-teal/40">
      <video
        ref={ref}
        src={`${src}#t=0.1`}
        muted
        loop
        autoPlay={autoplayVideo}
        playsInline
        preload={autoplayVideo ? 'auto' : 'metadata'}
        aria-hidden="true"
        tabIndex={-1}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onError={onError}
        className="size-full bg-black object-cover"
      />
      {/* 動画だと一目で分かるように、止まっているときはカードの真ん中に大きな再生マーク。左下に「2秒動画」の札（L9） */}
      {!playing && (
        <span data-testid="play-mark" aria-hidden className="absolute top-1/2 left-1/2 flex size-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white">
          <Play className="ml-1 size-8 fill-white" />
        </span>
      )}
      {playing && <Pause aria-hidden className="absolute right-2 top-2 size-5 fill-white text-white drop-shadow" />}
      <span data-testid="video-tag" className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2.5 py-1 text-note font-extrabold text-white">
        2秒動画
      </span>
    </button>
  );
}

// 見られない動画。中身は取りに行かず、ぼかした枠だけ。責めずに「1本撮ると見られます」。期限が過ぎたものは、期間が過ぎたことだけ伝える。
// 鍵のときは、その場から撮りにいけるボタンを添える（#438。行き止まりにしない）
function ClosedVideo({ state, label }: { state: MediaState; label: string }) {
  const expired = state === 'expired';
  return (
    <div className="absolute inset-0">
      <div aria-hidden className="absolute inset-0 bg-line blur-md" />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center text-sm font-bold text-fg-muted">
        <div role="img" aria-label={`${label}: ${expired ? '見られる期間が過ぎました' : VIDEO_GRID_MESSAGES.locked}`} className="flex flex-col items-center gap-2">
          <Lock aria-hidden className="size-7" />
          <span>{expired ? '見られる期間が 過ぎました' : VIDEO_GRID_MESSAGES.locked}</span>
        </div>
        {!expired && <ShootButton />}
      </div>
    </div>
  );
}
