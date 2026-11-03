import { ApiError } from '@/lib/api/api-error';

// 送れなかったときの扱い（design.md 7章「送れなかったときの送信待ちの扱い（F-30）」。判断ログ 01-7）。
//   5xx・408・429・通信の断   → 送信待ちに残し、間隔を空けて再送する（件数の上限なし）
//   401                        → 捨てない。ログインし直したら送る（短い間隔で確かめ続ける）
//   404（セットの追加だけ）    → 親の記録がまだ無いだけかもしれないので、少しだけ待って再送する（上限あり）
//   400・403・409・上記以外の 4xx → 再送しても直らないので外し、「送れなかった記録」として1回だけ知らせる
export type SendFailure = 'retry' | 'auth' | 'parent-missing' | 'reject';

// 送信待ちが取り除かれた（持ち主が違う・片づけられた）あとに、再送の順番が回ってきたとき。送らずに終える
export class SendCancelled extends Error {
  constructor() {
    super('送信待ちが取り除かれました');
    this.name = 'SendCancelled';
  }
}

export function classifyFailure(error: unknown): SendFailure {
  if (error instanceof SendCancelled) return 'reject';
  if (!(error instanceof ApiError)) return 'retry'; // fetch が例外を投げた＝通信の断
  const s = error.status;
  if (s === 401) return 'auth';
  if (s === 404) return 'parent-missing';
  if (s >= 500 || s === 408 || s === 429) return 'retry';
  return 'reject';
}

// 親の記録を待つ 404 の再送の回数（同じ scope は1本ずつ順に送るので、通常は親が先に成功している。数回待って直らなければ外す）
export const PARENT_MISSING_MAX_RETRIES = 3;

// 作成系（記録を作る・セットを足す）の retry 関数。true の間、送信は「送信待ち」のまま残る
export function shouldRetrySend(kind: 'record' | 'set') {
  return (failureCount: number, error: unknown): boolean => {
    const c = classifyFailure(error);
    if (c === 'retry' || c === 'auth') return true;
    if (c === 'parent-missing') return kind === 'set' && failureCount < PARENT_MISSING_MAX_RETRIES;
    return false;
  };
}

export const AUTH_RETRY_MS = 3_000;
export const RETRY_BACKOFF_MS = [2_000, 5_000, 15_000, 30_000] as const; // 最後の間隔のまま続ける

// 再送の間隔。失敗回数が増えるほど空ける（failureCount は、これまでに失敗した回数で 0 から始まる）。
// 401 は短い間隔で確かめる（ログインし直したらすぐ送るため）
export function sendRetryDelay(failureCount: number, error: unknown): number {
  if (classifyFailure(error) === 'auth') return AUTH_RETRY_MS;
  return RETRY_BACKOFF_MS[Math.min(Math.max(failureCount, 0), RETRY_BACKOFF_MS.length - 1)];
}
