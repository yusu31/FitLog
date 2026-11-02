'use client';

import { useQueryClient } from '@tanstack/react-query';
import { LogOut } from 'lucide-react';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/fitlog/confirm-dialog';
import { getGetCurrentGroupQueryKey, useLeaveGroup } from '@/lib/api/generated';
import { GROUP_MESSAGES, groupErrorMessage } from '@/lib/messages';

// グループを出る（DELETE /groups/current/members/me）。取り消せない操作なので、確認のダイアログを挟んでから送る。
// 出た人の記録は残るが、仲間には見えなくなる（T-GRP-07）。もう一度入るには新しい招待リンクが要る
export function LeaveGroup({ onLeft }: { onLeft?: () => void }) {
  const queryClient = useQueryClient();
  const leave = useLeaveGroup();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onLeave() {
    setError(null);
    try {
      const res = await leave.mutateAsync();
      if (res.status !== 204) {
        setConfirming(false);
        setError(groupErrorMessage(res.data, GROUP_MESSAGES.leaveFailed, res.status));
        return;
      }
      setConfirming(false);
      onLeft?.();
      await queryClient.invalidateQueries({ queryKey: getGetCurrentGroupQueryKey() });
    } catch {
      setConfirming(false);
      setError(GROUP_MESSAGES.network);
    }
  }

  return (
    <section aria-label="グループを出る" className="pt-2 pb-6">
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="mx-auto flex min-h-11 items-center gap-1.5 rounded-fl px-3 text-sm font-bold text-sub outline-none focus-visible:ring-4 focus-visible:ring-teal/40"
      >
        <LogOut aria-hidden className="size-4" />
        グループを出る
      </button>
      {error && (
        <p role="alert" className="mt-2 rounded-lg bg-coral-light px-3 py-2 text-sm font-bold text-ink">
          {error}
        </p>
      )}
      <ConfirmDialog
        open={confirming}
        title="グループを出ますか？"
        description="出ると、仲間の記録が見えなくなります。あなたの記録は残ります。もう一度入るには、新しい招待リンクが必要です。"
        confirmLabel="出る"
        pendingLabel="出ています…"
        pending={leave.isPending}
        onConfirm={onLeave}
        onCancel={() => setConfirming(false)}
      />
    </section>
  );
}
