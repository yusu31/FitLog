'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Video } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { ThickButton } from '@/components/fitlog/thick-button';
import { VideoRecorder, canRecordVideo } from '@/components/record/video-recorder';
import { getGetFeedQueryKey, getGetVideosThisWeekQueryKey, ListRecordsKind, useListRecords } from '@/lib/api/generated';
import { setFilmFirst } from '@/lib/film-first';
import { toLocalDate } from '@/lib/shared/local-date';
import { VIDEO_GRID_MESSAGES } from './messages';

const noSubscribe = () => () => {};

// 鍵の付いた仲間の動画から、そのまま撮りにいく入口（#438）。
// 今日の筋トレの記録があれば（あとから記録は除く）、その場で撮影を開く。無ければ種目選びへ進み、最初の1セットのあとに撮影が開く（film-first）。
// 撮れない端末では、押しても進めないので理由だけ出す
export function ShootButton() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const capable = useSyncExternalStore(noSubscribe, canRecordVideo, () => false);
  const workouts = useListRecords({ kind: ListRecordsKind.workout, limit: '5' }, { query: { enabled: capable } });
  const [recordId, setRecordId] = useState<string | null>(null);

  if (!capable) return <p className="text-note font-bold text-fg-muted">{VIDEO_GRID_MESSAGES.cannotShoot}</p>;

  function onShoot() {
    const today = toLocalDate(new Date());
    const items = workouts.data?.status === 200 ? workouts.data.data.items : [];
    const mine = items.find((r) => r.localDate === today && !r.late);
    if (mine) {
      setRecordId(mine.id);
      return;
    }
    setFilmFirst(true);
    router.push('/exercises');
  }

  // 撮れていれば鍵が外れるように、鍵の条件と足跡を取り直す
  function onClose() {
    setRecordId(null);
    void queryClient.invalidateQueries({ queryKey: getGetVideosThisWeekQueryKey() });
    void queryClient.invalidateQueries({ queryKey: getGetFeedQueryKey() });
  }

  return (
    <>
      <ThickButton size="sm" disabled={workouts.isPending} onClick={onShoot}>
        <Video aria-hidden className="size-5" />
        {VIDEO_GRID_MESSAGES.shoot}
      </ThickButton>
      {recordId && createPortal(<VideoRecorder recordId={recordId} onClose={onClose} />, document.body)}
    </>
  );
}
