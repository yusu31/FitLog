'use client';

import { useQueryClient } from '@tanstack/react-query';
import { LogOut } from 'lucide-react';
import { useState } from 'react';
import { ThickButton } from '@/components/fitlog/thick-button';
import { getGetCurrentGroupQueryKey, useLeaveGroup } from '@/lib/api/generated';
import { messageOf } from '@/lib/api/message';

// グループを出る（DELETE /groups/current/members/me）。押し間違いを防ぐため、確かめてから送る。
// 本来は S-32 グループの設定に置く。設定の画面ができるまで、仲間タブの下に置く
export function LeaveGroup() {
  const queryClient = useQueryClient();
  const leave = useLeaveGroup();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onLeave() {
    setError(null);
    try {
      const res = await leave.mutateAsync();
      if (res.status !== 204) {
        setError(messageOf(res.data, 'グループを出られませんでした'));
        return;
      }
      await queryClient.invalidateQueries({ queryKey: getGetCurrentGroupQueryKey() });
    } catch {
      setError('通信に失敗しました。電波の良い所でもう一度お試しください');
    }
  }

  return (
    <section aria-label="グループを出る" className="pt-2 pb-6">
      {confirming ? (
        <div className="fl-slab space-y-3 border-coral-light px-4 py-4">
          <p className="text-sm font-bold">
            グループを出ると、仲間の記録が見えなくなります。もう一度入るには、新しい招待リンクが必要です。
          </p>
          <div className="flex gap-2">
            <ThickButton tone="coral" size="sm" onClick={onLeave} disabled={leave.isPending} className="flex-1">
              {leave.isPending ? '出ています…' : '出る'}
            </ThickButton>
            <ThickButton tone="white" size="sm" onClick={() => setConfirming(false)}>
              やめる
            </ThickButton>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="mx-auto flex min-h-11 items-center gap-1.5 rounded-fl px-3 text-sm font-bold text-sub outline-none focus-visible:ring-4 focus-visible:ring-teal/40"
        >
          <LogOut aria-hidden className="size-4" />
          グループを出る
        </button>
      )}
      {error && (
        <p role="alert" className="mt-2 rounded-lg bg-coral-light px-3 py-2 text-sm font-bold text-ink">
          {error}
        </p>
      )}
    </section>
  );
}
