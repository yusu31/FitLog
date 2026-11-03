// 送信待ちから外された（再送しても直らない＝400・403・409 など）作成系の送信の控え。
// 送信待ちの帯が「送れなかった記録があります」を1回だけ知らせるために数える（design.md 7章）。
// 画面の部品の外（TanStack Query の onError）から書くので、小さな外部ストアにしてある。
export type RejectedSend = { status: number; at: number };

const listeners = new Set<() => void>();
let rejected: readonly RejectedSend[] = [];

export const getRejectedSends = (): readonly RejectedSend[] => rejected;

export function subscribeRejectedSends(fn: () => void): () => void {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}

export function addRejectedSend(status: number): void {
  rejected = [...rejected, { status, at: Date.now() }];
  listeners.forEach((f) => f());
}

// テスト用・持ち主が変わったとき用
export function resetRejectedSends(): void {
  rejected = [];
  listeners.forEach((f) => f());
}
