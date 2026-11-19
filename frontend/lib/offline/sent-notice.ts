'use client';

import { useEffect, useSyncExternalStore } from 'react';

// 「N件 送ったよ」を出すための控え（A11-1）。
// 画面の部品（帯）の中に持つと、画面を移ったときに「送れた」が消えてしまうので、画面の外の小さな外部ストアに置く。
// 帯が出ていない画面（記録・詳細など）でも、画面全体の入れ物（QueueOwner）が同じ控えを進める。
export const SENT_VISIBLE_MS = 3000;

export type SentNotice = { n: number; seq: number };
export type SentState = { peak: number; notice: SentNotice | null };

const listeners = new Set<() => void>();
let state: SentState = { peak: 0, notice: null };
let base = 0; // 帯を出し始めたとき、すでに外されていた件数
let seq = 0;
let timer: ReturnType<typeof setTimeout> | undefined;

const emit = (next: SentState) => {
  state = next;
  listeners.forEach((f) => f());
};

// count=いまの送信待ち、waiting=帯を出す状態か、rejected=外された件数。同じ入力で何度呼んでも結果は同じ
export function advanceSent(count: number, waiting: boolean, rejected: number): void {
  if (count > 0 && (waiting || state.peak > 0)) {
    if (count > state.peak) {
      if (state.peak === 0) base = rejected;
      clearTimeout(timer);
      emit({ peak: count, notice: null });
    }
  } else if (count === 0 && state.peak > 0) {
    // 外された（送れなかった）分は「送ったよ」に数えない
    const delivered = state.peak - (rejected - base);
    base = 0;
    clearTimeout(timer);
    if (delivered > 0) {
      const mine = ++seq;
      emit({ peak: 0, notice: { n: delivered, seq: mine } });
      timer = setTimeout(() => {
        if (state.notice?.seq === mine) emit({ ...state, notice: null });
      }, SENT_VISIBLE_MS);
    } else {
      emit({ peak: 0, notice: null });
    }
  }
}

export function resetSentNotice(): void {
  clearTimeout(timer);
  base = 0;
  emit({ peak: 0, notice: null });
}

export function useSentNotice(count: number, waiting: boolean, rejected: number): SentState {
  useEffect(() => advanceSent(count, waiting, rejected), [count, waiting, rejected]);
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => void listeners.delete(fn);
    },
    () => state,
    () => state,
  );
}
