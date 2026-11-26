'use client';

import { useState } from 'react';
import { useGetVideoUrl } from '@/lib/api/generated';

// 再生用の署名付き URL の期限は 300 秒（backend video-storage.ts の VIDEO_URL_EXPIRES_SECONDS）。
// 全体の既定（staleTime 30秒・gcTime 1日）のままだと、5分を過ぎた URL をキャッシュから使い回して再生に失敗する。
// 期限より短い 4 分でキャッシュを捨て、別の画面から戻ったときは新しい URL を取り直す
const URL_FRESH_MS = 4 * 60_000;

// 動画の URL をもらい、再生に失敗したら1回だけ URL を取り直す（期限切れの URL だった場合に直る）。
// 2回目も失敗したら failed にする（本当に置けていない・再生できない形式）
export function usePlayableVideoUrl(videoId: string) {
  const query = useGetVideoUrl(videoId, { query: { staleTime: URL_FRESH_MS, gcTime: URL_FRESH_MS } });
  const [retried, setRetried] = useState(false);
  const [failed, setFailed] = useState(false);

  const onError = () => {
    if (retried) {
      setFailed(true);
      return;
    }
    setRetried(true);
    void query.refetch();
  };

  return { data: query.data, isPending: query.isPending, failed, onError };
}
