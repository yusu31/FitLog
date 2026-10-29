import { AsyncLocalStorage } from 'node:async_hooks';

// 1回のリクエストの間だけ持つ入れ物（docs/operations.md 1-2）。
// 途中の関数に requestId を引数で渡し回さず、ログを出す側がここから読む。
export interface RequestContext {
  requestId: string;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();
