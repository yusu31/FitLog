// ログインできたはずなのに、次の画面でセッションが取れず、ログイン画面へ戻されるとき（Cookie が保存されない端末など）を見分ける。
// 何も言わずに戻すと「ログインできない」理由が分からないので、ログイン画面に理由を出す。
// ログイン直後の印を、この画面（タブ）の間だけ sessionStorage に持つ。保存できない環境では印なし（今までどおり黙って戻す）
const KEY = 'fitlog-just-signed-in';
export const LOGIN_FAILED_PARAM = 'failed';
export const LOGIN_SESSION_FAILED = 'ログインできませんでした（Cookie が保存されない）';
export const LOGIN_SESSION_FAILED_HINT = 'ブラウザの設定で Cookie を許可しているか、プライベートモードでないかを確かめてください';

export function markJustSignedIn(): void {
  try {
    sessionStorage.setItem(KEY, '1');
  } catch {
    // 印が付けられなければ、理由を出せないだけ
  }
}

export function clearJustSignedIn(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // 何もしない
  }
}

function justSignedIn(): boolean {
  try {
    return sessionStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

// 未ログインでログイン画面へ移す先。ログイン直後だった（印がある）なら、理由つきにして印を消す
export function loginRedirectPath(target: string): string {
  const base = `/login?next=${encodeURIComponent(target)}`;
  if (!justSignedIn()) return base;
  clearJustSignedIn();
  return `${base}&${LOGIN_FAILED_PARAM}=1`;
}

export function readLoginFailed(): boolean {
  return new URLSearchParams(window.location.search).get(LOGIN_FAILED_PARAM) === '1';
}
