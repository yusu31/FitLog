'use client';

import { Video } from 'lucide-react';
import { useState, useSyncExternalStore } from 'react';
import { ThickButton } from '@/components/fitlog/thick-button';
import { AutoVideoRecorder } from '@/components/record/auto-video-recorder';
import { canRecordVideo } from '@/components/record/video-recorder';
import { VIDEO_GRID_MESSAGES } from './messages';

const noSubscribe = () => () => {};

// 鍵の付いた仲間の動画から、そのまま撮りにいく入口（#438）。
// 押すとその場で撮影が開く。付け先は自動（記録中の筋トレ → 今日の動画がまだ無い記録 → 投稿。PR 4）で、筋トレの記録が無くても撮れる。
// 撮れない端末では、押しても進めないので理由だけ出す
export function ShootButton() {
  const capable = useSyncExternalStore(noSubscribe, canRecordVideo, () => false);
  const [open, setOpen] = useState(false);

  if (!capable) return <p className="text-note font-bold text-fg-muted">{VIDEO_GRID_MESSAGES.cannotShoot}</p>;

  return (
    <>
      <ThickButton size="sm" onClick={() => setOpen(true)}>
        <Video aria-hidden className="size-5" />
        {VIDEO_GRID_MESSAGES.shoot}
      </ThickButton>
      {open && <AutoVideoRecorder onClose={() => setOpen(false)} />}
    </>
  );
}
