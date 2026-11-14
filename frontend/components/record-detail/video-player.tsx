'use client';

import { useState } from 'react';
import { useGetVideoUrl } from '@/lib/api/generated';
import { DETAIL_MESSAGES } from '@/lib/messages';

// S-21 の2秒動画（features.md F-13）。短い期限の署名付き URL を API からもらって再生する。
// 自動再生はしない（音なし・タップで再生・ループ）。仲間に見える期限（その週の日曜 24:00 日本時間）が過ぎたら 403 で、本人だけ見られる。
// 置けていない動画・再生できない形式（iPhone の Safari で webm など）は、責めずに「再生できませんでした」とだけ出す
export function VideoPlayer({ videoId }: { videoId: string }) {
  const { data, isPending } = useGetVideoUrl(videoId);
  const [failed, setFailed] = useState(false);

  if (isPending) {
    return <div aria-busy="true" aria-label="動画を読み込み中" className="aspect-video w-full animate-pulse rounded-fl bg-face" />;
  }
  // 仲間の動画は、今週自分も撮ると見られる（案B）。責めずに、撮ると見られることだけ伝える
  if (data?.status === 403 && data.data.code === 'VIDEO_LOCKED') {
    return (
      <p className="fl-slab px-4 py-5 text-center text-sm font-bold text-sub-strong">
        <span aria-hidden="true">🔒 </span>
        {DETAIL_MESSAGES.videoLocked}
      </p>
    );
  }
  if (data?.status === 403) {
    return <p className="fl-slab px-4 py-5 text-center text-sm font-bold text-sub-strong">{DETAIL_MESSAGES.videoExpired}</p>;
  }
  if (data?.status !== 200 || failed) {
    return <p className="fl-slab px-4 py-5 text-center text-sm font-bold text-sub-strong">{DETAIL_MESSAGES.videoUnavailable}</p>;
  }
  return (
    <video
      aria-label={DETAIL_MESSAGES.videoLabel}
      src={data.data.url}
      controls
      muted
      loop
      playsInline
      preload="metadata"
      onError={() => setFailed(true)}
      className="aspect-video w-full rounded-fl bg-black object-cover"
    />
  );
}
