'use client';

import { useSyncExternalStore } from 'react';
import { DEFAULT_NEXT_PATH, safeNextPath } from '@/lib/next-path';

const subscribe = () => () => {};
const readNext = () => safeNextPath(new URLSearchParams(window.location.search).get('next'));

// ログイン・登録のあとに戻る先（?next=）。useSearchParams は静的書き出しで Suspense が要り、
// フォームごと HTML から消える（JS が動くまで空白になる）ため使わない。
// サーバー側（書き出し）は既定の値で描き、ブラウザでは URL から読む。値は safeNextPath で、このサイトの中のパスだけに絞る
export function useNextParam(): string {
  return useSyncExternalStore(subscribe, readNext, () => DEFAULT_NEXT_PATH);
}
