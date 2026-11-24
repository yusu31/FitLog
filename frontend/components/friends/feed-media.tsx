'use client';

import { Lock, Pause, Play } from 'lucide-react';
import { useRef, useState } from 'react';
import { Avatar } from '@/components/fitlog/avatar';
import { VIDEO_GRID_MESSAGES } from '@/components/video-grid/messages';
import { useGetCurrentGroup, useGetVideosThisWeek, useGetVideoUrl, type FeedItem, type FeedStamp } from '@/lib/api/generated';
import { usePreferences } from '@/lib/use-preferences';

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

export function FeedMedia({ item, isOwn, title, detail }: { item: FeedItem; isOwn: boolean; title: string; detail: string }) {
  const { data } = useGetVideosThisWeek();
  const unlocked = data?.status === 200 ? data.data.unlocked : false;
  const state = mediaState({ isOwn, visibleUntil: item.videoVisibleUntil, unlocked });
  const label = `${item.author.name}の${title}の動画`;
  return (
    <div data-testid="feed-media" className="relative aspect-[3/4] w-full overflow-hidden rounded-fl bg-canvas">
      {state === 'open' && item.videoId ? <OpenVideo videoId={item.videoId} label={label} /> : <ClosedVideo state={state} label={label} />}
      <div className="absolute top-2 left-2 max-w-[75%]">
        <NumberBadge title={title} detail={detail} />
      </div>
      <div className="absolute right-2 bottom-2">
        <Faces stamps={item.stamps} />
      </div>
    </div>
  );
}

// 動画が無いカードの「数字の札」＋反応の顔（同じ部品。写真の面が無いだけ）
export function MediaBadges({ item, title, detail }: { item: FeedItem; title: string; detail: string }) {
  const hasFaces = item.stamps.some((s) => s.by.length > 0);
  return (
    <div className="flex items-center justify-between gap-2">
      <NumberBadge title={title} detail={detail} flat />
      {hasFaces ? <Faces stamps={item.stamps} flat /> : null}
    </div>
  );
}

// 記録の数字の札。種目名・距離など。写真の上では半透明の黒に白字、写真が無いときは通常の面
function NumberBadge({ title, detail, flat = false }: { title: string; detail: string; flat?: boolean }) {
  return (
    <p
      data-testid="number-badge"
      className={
        flat
          ? 'inline-flex max-w-full items-baseline gap-1.5 rounded-full bg-canvas px-3 py-1.5 text-fg'
          : 'inline-flex max-w-full items-baseline gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-white'
      }
    >
      <span className="truncate text-[15px] font-extrabold">{title}</span>
      {detail ? <span className="fl-num shrink-0 text-sm font-bold">{detail}</span> : null}
    </p>
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
  const { data, isPending } = useGetVideoUrl(videoId);
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const ref = useRef<HTMLVideoElement>(null);
  const { autoplayVideo } = usePreferences();
  const src = data?.status === 200 ? data.data.url : undefined;
  const playable = Boolean(src) && !failed;

  function toggle() {
    const el = ref.current;
    if (!el) return;
    if (el.paused) void el.play().catch(() => setFailed(true));
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
        onError={() => setFailed(true)}
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

// 見られない動画。中身は取りに行かず、ぼかした枠だけ。責めずに「1本撮ると見られます」。期限が過ぎたものは、期間が過ぎたことだけ伝える
function ClosedVideo({ state, label }: { state: MediaState; label: string }) {
  const expired = state === 'expired';
  return (
    <div role="img" aria-label={`${label}: ${expired ? '見られる期間が過ぎました' : VIDEO_GRID_MESSAGES.locked}`} className="absolute inset-0">
      <div aria-hidden className="absolute inset-0 bg-line blur-md" />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center text-sm font-bold text-fg-muted">
        <Lock aria-hidden className="size-7" />
        <span>{expired ? '見られる期間が 過ぎました' : VIDEO_GRID_MESSAGES.locked}</span>
      </div>
    </div>
  );
}
