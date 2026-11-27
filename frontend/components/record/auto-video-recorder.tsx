'use client';

import { useQueryClient } from '@tanstack/react-query';
import { createPortal } from 'react-dom';
import { getGetFeedQueryKey, getGetMyVideosQueryKey, getGetVideosThisWeekQueryKey, getListRecordsQueryKey } from '@/lib/api/generated';
import { VideoRecorder } from './video-recorder';

// 付け先を自動で決める撮影（PR 4）。どの画面からでも開ける（中央の扇の「撮影」・仲間の動画の鍵の「撮りにいく」）。
// 付け先の決め方は VideoRecorder の resolveTarget（記録中の筋トレ → 今日の動画がまだ無い記録 → 投稿）。
// 閉じたときに、撮れていれば出る所（鍵・足跡・自分の動画・記録の一覧）を取り直す
export function AutoVideoRecorder({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  function close() {
    onClose();
    void queryClient.invalidateQueries({ queryKey: getGetVideosThisWeekQueryKey() });
    void queryClient.invalidateQueries({ queryKey: getGetFeedQueryKey() });
    void queryClient.invalidateQueries({ queryKey: getGetMyVideosQueryKey() });
    void queryClient.invalidateQueries({ queryKey: getListRecordsQueryKey() });
  }
  return createPortal(<VideoRecorder onClose={close} />, document.body);
}
