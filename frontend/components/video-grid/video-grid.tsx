'use client';

import { Lock, Play } from 'lucide-react';
import { cn } from 'cn';
import { usePlayableVideoUrl } from '@/lib/video/use-video-url';
import { VIDEO_GRID_MESSAGES } from './messages';
import { EmptyState } from '@/components/fitlog/empty-state';

// 2秒動画のサムネの並び（台帳 A14-2）。2つの使い方を1つの部品で持つ。
//  - strip: 仲間タブの「今週のサムネ列」（横に並ぶ）
//  - grid: 「自分」タブの過去の動画のグリッド（3列）
// 見られるかどうかは決めない。部品は GET /videos/week の unlocked・mine を受け取って描くだけで、
// 動画の URL は GET /videos/{id}/url（API が閲覧条件を守る）からもらう。locked の動画は URL を取りに行かず、ぼかして「1本撮ると見られる」を出す。
// 動画はタップで選ぶ（再生は呼び出し側。記録の詳細の VideoPlayer へ進むなど）。サムネは動画の先頭の1コマ
export type VideoGridItem = {
  id: string;
  // 画面の読み上げと札に使う短い文（「たろう」「11/2」など）
  label: string;
  // 自分の動画なら true（条件なしで見られる）
  mine?: boolean;
};

export type VideoGridProps = {
  items: VideoGridItem[];
  layout: 'strip' | 'grid';
  // 自分が今週まだ撮っていない（GET /videos/week の unlocked=false）。mine でない動画を locked にする
  locked?: boolean;
  onSelect?: (id: string) => void;
};

export function VideoGrid({ items, layout, locked = false, onSelect }: VideoGridProps) {
  if (items.length === 0) {
    return <EmptyState title={VIDEO_GRID_MESSAGES[layout === 'strip' ? 'emptyStrip' : 'emptyGrid']} pose="relax" />;
  }
  return (
    <ul
      aria-label={VIDEO_GRID_MESSAGES[layout === 'strip' ? 'stripLabel' : 'gridLabel']}
      className={cn(layout === 'strip' ? 'flex gap-2 overflow-x-auto pb-1' : 'grid grid-cols-3 gap-2')}
    >
      {items.map((item) => (
        <li key={item.id} className={cn(layout === 'strip' && 'w-24 shrink-0')}>
          {locked && !item.mine ? <LockedTile item={item} /> : <OpenTile item={item} onSelect={onSelect} />}
        </li>
      ))}
    </ul>
  );
}

const TILE = 'relative block aspect-[3/4] w-full overflow-hidden rounded-fl bg-canvas';

// 見られない動画。中身は取りに行かない（ぼかした枠だけ）。責めずに「1本撮ると見られる」とだけ伝える
function LockedTile({ item }: { item: VideoGridItem }) {
  return (
    <div role="img" aria-label={`${item.label}: ${VIDEO_GRID_MESSAGES.locked}`} className={TILE}>
      <div aria-hidden="true" className="absolute inset-0 bg-line blur-md" />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-1 text-center text-note font-bold text-fg-muted">
        <Lock aria-hidden="true" className="size-5" />
        <span>{VIDEO_GRID_MESSAGES.locked}</span>
      </div>
      <Caption label={item.label} />
    </div>
  );
}

// 見られる動画。短い期限の署名付き URL をもらい、先頭の1コマをサムネにする（音なし・自動再生しない）
function OpenTile({ item, onSelect }: { item: VideoGridItem; onSelect?: (id: string) => void }) {
  const { data, isPending, failed, onError } = usePlayableVideoUrl(item.id);
  const src = data?.status === 200 ? data.data.url : undefined;
  const playable = Boolean(src) && !failed;
  return (
    <button type="button" onClick={() => onSelect?.(item.id)} aria-label={VIDEO_GRID_MESSAGES.open(item.label)} className={cn(TILE, 'text-left')}>
      {isPending ? <div aria-busy="true" className="absolute inset-0 animate-pulse bg-canvas" /> : null}
      {playable ? (
        <video
          src={`${src}#t=0.1`}
          muted
          playsInline
          preload="metadata"
          aria-hidden="true"
          tabIndex={-1}
          onError={onError}
          className="absolute inset-0 size-full bg-black object-cover"
        />
      ) : null}
      {!isPending && !playable ? (
        <span className="absolute inset-0 flex items-center justify-center px-1 text-center text-note font-bold text-fg-muted">{VIDEO_GRID_MESSAGES.unavailable}</span>
      ) : null}
      {playable ? <Play aria-hidden="true" className="absolute right-1 top-1 size-4 fill-surface text-white drop-shadow" /> : null}
      <Caption label={item.label} />
    </button>
  );
}

function Caption({ label }: { label: string }) {
  return <span className="absolute inset-x-0 bottom-0 truncate bg-black/55 px-1.5 py-0.5 text-note font-bold text-white">{label}</span>;
}
