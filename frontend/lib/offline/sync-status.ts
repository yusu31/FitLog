'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';
import { ApiError } from '@/lib/api/api-error';
import { isQueuedMutation } from './persister';

// 送信待ちの状態（画面上部の帯の元。screen-design.md「送信待ちの表示（F-30）」・T-OFF-07）。
export type QueueSummary = {
  count: number; // 送信待ち（まだ API に届いていない作成系の送信）の件数。筋トレ・ランの区別なく合計
  retrying: boolean; // 送ろうとして送れなかったものがある（5xx・通信の断など。再送待ち）
  authExpired: boolean; // 401 で止まっているものがある（ログインし直したら送る）
};

type MutationLike = Parameters<typeof isQueuedMutation>[0] & { state: { failureCount?: number; failureReason?: unknown } };

export function summarizeQueue(mutations: readonly MutationLike[]): QueueSummary {
  const queued = mutations.filter(isQueuedMutation);
  return {
    count: queued.length,
    retrying: queued.some((m) => (m.state.failureCount ?? 0) > 0),
    authExpired: queued.some((m) => m.state.failureReason instanceof ApiError && m.state.failureReason.status === 401),
  };
}

// 帯を出すか: 送信待ちがあり、かつ（電波が無い・再送待ち）のとき。電波があって送っている最中（ふつう1秒ほど）は出さない
export const isWaiting = (s: QueueSummary, online: boolean): boolean => s.count > 0 && (!online || s.retrying || s.authExpired);

export function useQueueSummary(): QueueSummary {
  const client = useQueryClient();
  const cache = client.getMutationCache();
  // useSyncExternalStore は同じ中身なら同じ値を返す必要があるので、文字列にして比べる
  const snap = useSyncExternalStore(
    (notify) => cache.subscribe(notify),
    () => {
      const s = summarizeQueue(cache.getAll());
      return `${s.count}|${s.retrying ? 1 : 0}|${s.authExpired ? 1 : 0}`;
    },
    () => '0|0|0',
  );
  const [count, retrying, auth] = snap.split('|');
  return { count: Number(count), retrying: retrying === '1', authExpired: auth === '1' };
}
