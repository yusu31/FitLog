'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Film } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/fitlog/confirm-dialog';
import { ThickButton } from '@/components/fitlog/thick-button';
import { sendErrorText } from '@/lib/api/api-error';
import { deleteRecordVideo, getGetFeedQueryKey, getGetMyVideosQueryKey, getGetRecordQueryKey, getGetVideosThisWeekQueryKey, getListRecordsQueryKey } from '@/lib/api/generated';
import { VIDEO_DELETE_MESSAGES as M } from '@/lib/messages';
import { useOnline } from '@/lib/use-browser-state';

// 動画だけ消す（PR 4）。S3 のファイルも消える。投稿は動画が無いと中身が無いので、動画を消すと投稿ごと消える（確認の文に出す）。
// ほかの種類は、動画だけ消えて記録は残る。自分の動画があるときだけ出す
export function RecordVideoDelete({ recordId, isPost }: { recordId: string; isPost: boolean }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const online = useOnline();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onConfirm() {
    setPending(true);
    setError(null);
    try {
      const res = await deleteRecordVideo(recordId);
      if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
      setConfirming(false);
      void queryClient.invalidateQueries({ queryKey: getGetVideosThisWeekQueryKey() });
      void queryClient.invalidateQueries({ queryKey: getGetMyVideosQueryKey() });
      void queryClient.invalidateQueries({ queryKey: getGetFeedQueryKey() });
      void queryClient.invalidateQueries({ queryKey: getListRecordsQueryKey() });
      if (res.data.recordDeleted) router.replace('/me');
      else await queryClient.invalidateQueries({ queryKey: getGetRecordQueryKey(recordId) });
    } catch (e) {
      setConfirming(false);
      setError(sendErrorText(e, M.error));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-2">
      <ThickButton variant="danger" size="sm" className="mx-auto flex" disabled={!online || pending} onClick={() => setConfirming(true)}>
        <Film aria-hidden />
        {M.button}
      </ThickButton>
      {error && (
        <p role="alert" className="rounded-fl bg-coral-light px-4 py-3 text-sm font-bold text-fg">
          {error}
        </p>
      )}
      <ConfirmDialog
        open={confirming}
        title={M.title}
        description={isPost ? M.notePost : M.noteOther}
        confirmLabel={M.confirm}
        pendingLabel={M.pending}
        pending={pending}
        onConfirm={() => void onConfirm()}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}
