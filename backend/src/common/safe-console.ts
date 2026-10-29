import type { Logger } from '@nestjs/common';
import { errorCode, looksLikeSql } from './error-code.js';

// console.error を、秘密を出さない形に包む。
// 理由: better-auth が使う better-call は、DB のようなエラーを `console.error('# SERVER_ERROR: ', error)` にそのまま出す（better-call/dist/router.mjs）。
// この出力には SQL の引数（メールアドレス・パスワードのハッシュ）が含まれ、better-auth の logger 設定でも onAPIError でも止められない。
// 本番のログ（CloudWatch）に残ると docs/operations.md 1-3 に反するので、Error は「種類と印」だけを自前のログに出し、本文は捨てる。
// 同じ理由で、SQL らしい文字列と、Error 以外のオブジェクトも本文を捨てる。文字列と数だけの出力は、そのまま元の console.error に渡す。
const INSTALLED = Symbol.for('fitlog.safeConsole');

export function installSafeConsole(logger: Logger): void {
  const original = console.error as typeof console.error & { [INSTALLED]?: boolean };
  if (original[INSTALLED]) return;

  const safe = (...args: unknown[]): void => {
    const err = args.find((a): a is Error => a instanceof Error);
    if (err) {
      logger.error({ msg: 'console.error', event: 'console.error', errName: err.name, code: errorCode(err) });
      return;
    }
    // Error 以外のオブジェクト（中に何が入っているか分からない）も、SQL らしい文字列と同じく本文を捨てる
    if (args.some((a) => (a !== null && typeof a === 'object') || (typeof a === 'string' && looksLikeSql(a)))) {
      logger.error({ msg: 'console.error', event: 'console.error', dropped: true });
      return;
    }
    original(...args);
  };
  Object.defineProperty(safe, INSTALLED, { value: true });
  console.error = safe;
}
