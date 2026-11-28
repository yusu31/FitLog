import { useSyncExternalStore } from 'react';

// 「デモ仲間 有り／無し」の切替（02-9 ⑭・Issue #475）。講師・転職先に見せるときに、仲間の見本4人をホームのタイムラインに入れる。
// 既定は無し。端末に覚える（保存できない端末では、この画面を開いている間だけ有効）
export const DEMO_FRIENDS_KEY = 'fitlog.demoFriends';

let memory = false; // 保存できない端末のための手元の値
const listeners = new Set<() => void>();

export function readDemoFriends(): boolean {
  try {
    return localStorage.getItem(DEMO_FRIENDS_KEY) === '1';
  } catch {
    return memory;
  }
}

export function setDemoFriends(on: boolean): void {
  memory = on;
  try {
    if (on) localStorage.setItem(DEMO_FRIENDS_KEY, '1');
    else localStorage.removeItem(DEMO_FRIENDS_KEY);
  } catch {
    // 保存できなくても、手元の値で切り替える
  }
  listeners.forEach((fn) => fn());
}

function subscribe(notify: () => void): () => void {
  listeners.add(notify);
  return () => listeners.delete(notify);
}

// 書き出し時と最初の描画は「無し」にそろえ、そのあと端末の値に切り替わる
export function useDemoFriends(): boolean {
  return useSyncExternalStore(subscribe, readDemoFriends, () => false);
}
