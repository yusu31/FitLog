import type { QueryClient } from '@tanstack/react-query';
import { isQueuedMutation } from './persister';

// 再読み込み・アプリを開き直したあとの再送の開始（F-30）。
// 次の2つがそろってから始める: ①端末に保存した送信待ちを戻し終えた ②ログインしている人が分かった。
// ②を待つのは、別の人がログインした端末で、前の人の記録をその人の名前で送ってしまわないため
// （送信待ちの scope は「records:{利用者ID}」なので、持ち主が違うものは捨てる）。
type State = { restored: boolean; userId: string | null; started: boolean };
const states = new WeakMap<QueryClient, State>();
const stateOf = (client: QueryClient): State => {
  let s = states.get(client);
  if (!s) states.set(client, (s = { restored: false, userId: null, started: false }));
  return s;
};

export const scopeIdOf = (userId: string): string => `records:${userId}`;

function tryStart(client: QueryClient): void {
  const s = stateOf(client);
  if (!s.restored || !s.userId || s.started) return;
  s.started = true;
  const mine = scopeIdOf(s.userId);
  const cache = client.getMutationCache();
  for (const m of cache.getAll()) {
    if (!isQueuedMutation(m)) continue;
    if (m.options.scope?.id !== mine) cache.remove(m); // 持ち主が違う送信待ちは送らない
  }
  // 作った順（キャッシュに入った順）に始める。同じ scope は1本ずつ順に送られる
  for (const m of cache.getAll()) {
    if (isQueuedMutation(m)) void m.continue().catch(() => undefined);
  }
}

// 端末に保存した送信待ちを戻し終えた（PersistQueryClientProvider の onSuccess から呼ぶ）
export function markQueueRestored(client: QueryClient): void {
  stateOf(client).restored = true;
  tryStart(client);
}

// ログインしている人が分かった（registerRecordMutations から呼ぶ）
export function setQueueOwner(client: QueryClient, userId: string): void {
  const s = stateOf(client);
  if (s.userId === userId) return;
  s.userId = userId;
  s.started = false; // 持ち主が変わったら、前の人の送信待ちをもう一度ふるいにかける
  tryStart(client);
}
