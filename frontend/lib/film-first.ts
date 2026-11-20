// 「最初の2秒を撮っておく」の予約（D0 PR-3）。＋のシートのチェックを、記録画面へ橋渡しする。
// 動画は保存済みの記録にひも付く（署名付き URL を記録 ID で取る）ので、始める時点では撮れない。
// そこで予約だけ sessionStorage に置き、最初の1セットが保存されて記録 ID ができたら撮影を開いて、予約を消す。
// 使えない環境（プライベートモード等）では黙って何もしない
const KEY = "fitlog.film-first";

export function setFilmFirst(on: boolean): void {
  try {
    if (on) sessionStorage.setItem(KEY, "1");
    else sessionStorage.removeItem(KEY);
  } catch {
    // 何もしない
  }
}

export function hasFilmFirst(): boolean {
  try {
    return sessionStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}
