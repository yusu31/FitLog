'use client';

import { onlineManager } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';

// 電波があるか。TanStack Query の送信の一時停止と同じ判断（onlineManager）を使う
export function useOnline(): boolean {
  return useSyncExternalStore(
    (notify) => onlineManager.subscribe(notify),
    () => onlineManager.isOnline(),
    () => true,
  );
}

const SHORT = '(max-height: 500px)';

// 高さが低い画面か（スマホの横向き。L3）。CSS の short: と同じ条件。キャラの大きさのように、CSS だけでは変えにくいものに使う
export function useShortScreen(): boolean {
  return useSyncExternalStore(
    (notify) => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => {};
      const mq = window.matchMedia(SHORT);
      mq.addEventListener('change', notify);
      return () => mq.removeEventListener('change', notify);
    },
    () => (typeof window !== 'undefined' && !!window.matchMedia ? window.matchMedia(SHORT).matches : false),
    () => false,
  );
}

const REDUCE = '(prefers-reduced-motion: reduce)';

// 「動きを減らす」設定か。true のときは、動かさず表示だけにする（docs/screen-design.md 6章）
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    (notify) => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => {};
      const mq = window.matchMedia(REDUCE);
      mq.addEventListener('change', notify);
      return () => mq.removeEventListener('change', notify);
    },
    () => (typeof window !== 'undefined' && !!window.matchMedia ? window.matchMedia(REDUCE).matches : false),
    () => false,
  );
}
