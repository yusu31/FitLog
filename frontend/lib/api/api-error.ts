import { messageOf } from './message';

// orval が作る送信関数は、4xx・5xx でも例外を投げず { status, data } を返す。
// TanStack Query は「例外が出たら失敗」と数えるので、2xx 以外はここで ApiError にして投げる
// （再送の扱い＝5xx は残して再送・400/403/409 は外す、は 02-4 で status を見て決める。design.md 7章）。
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
  ) {
    super(messageOf(body, `HTTP ${status}`));
    this.name = 'ApiError';
  }
}

// 書き込みの失敗を、画面に出せる文言にする。4xx（入力の誤り・重複など）は API が返した日本語の文言を出し、
// 5xx・通信の失敗は内部の事情を出さず、呼ぶ側が決めた文言にする（design.md 5章・screen-design.md 5章）
export function sendErrorText(error: unknown, fallback: string): string {
  return error instanceof ApiError && error.status < 500 ? messageOf(error.body, fallback) : fallback;
}

// 成功（200・201・204）の応答だけを通し、型も成功の形に絞る
export function unwrap<T extends { status: number; data: unknown }>(res: T): Extract<T, { status: 200 | 201 | 204 }> {
  if (res.status >= 200 && res.status < 300) return res as Extract<T, { status: 200 | 201 | 204 }>;
  throw new ApiError(res.status, res.data);
}
