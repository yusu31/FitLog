import { useSyncExternalStore } from 'react';

// この端末で最後に保存した運動の種類（筋トレ＝lift／ラン＝run）。ログイン前の画面の上半分を、筋トレ版かラン版に切り替えるために覚える（D1・判断ログ 66）。
// ログイン前は誰か分からないので、サーバーには聞かず端末に覚える。初めての端末・覚えていないとき・休みだけのときは筋トレ版
export type LastKind = 'lift' | 'run';

export const LAST_KIND_KEY = 'fitlog-last-kind';

export const parseLastKind = (raw: string | null | undefined): LastKind => (raw === 'run' ? 'run' : 'lift');

export function readLastKind(): LastKind {
  try {
    return parseLastKind(localStorage.getItem(LAST_KIND_KEY));
  } catch {
    return 'lift';
  }
}

const listeners = new Set<() => void>();

// 記録を作ったときに呼ぶ。休み（rest）は種類として覚えない。保存できない環境（プライベートモードなど）では何もしない
export function rememberLastKind(kind: 'workout' | 'run' | 'rest'): void {
  if (kind === 'rest') return;
  try {
    localStorage.setItem(LAST_KIND_KEY, kind === 'run' ? 'run' : 'lift');
  } catch {
    return;
  }
  listeners.forEach((fn) => fn());
}

function subscribe(notify: () => void): () => void {
  listeners.add(notify);
  const onStorage = (e: StorageEvent) => {
    if (e.key === LAST_KIND_KEY || e.key === null) notify();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(notify);
    window.removeEventListener('storage', onStorage);
  };
}

// 画面用。サーバー側の描画と最初の描画は筋トレ版にそろえ、そのあと端末の値に切り替わる
export function useLastKind(): LastKind {
  return useSyncExternalStore(subscribe, readLastKind, () => 'lift');
}
