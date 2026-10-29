import type { Logger } from '@nestjs/common';
import { errorCode, looksLikeSql } from '../common/error-code.js';

// better-auth が自分で出すログを、アプリのログ（JSON・requestId つき）に通す。
// better-auth の標準は console に出すだけで、DB のエラーのときは SQL とその引数（メールアドレスやパスワードのハッシュ）を含む文字列を出しうる。
// docs/operations.md 1-3「出さないもの」を守るため、エラーが付いているときや SQL らしい文字列は、本文を捨てて「エラーの印」だけを出す。
export type AuthLogLevel = 'debug' | 'info' | 'warn' | 'error';

const MAX_DETAIL = 200;

export function logFromBetterAuth(logger: Logger, level: AuthLogLevel, message: string, ...args: unknown[]): void {
  const err = args.find((a): a is Error => a instanceof Error);
  const hasOtherObject = args.some((a) => a !== null && typeof a === 'object' && !(a instanceof Error));
  const fields: Record<string, unknown> = { msg: 'better-auth', event: 'auth.library_log' };

  if (err) {
    fields.errName = err.name;
    fields.code = errorCode(err);
  } else if (!hasOtherObject && !looksLikeSql(message) && message.length <= MAX_DETAIL) {
    // 注意書きのような短い文字列だけ通す
    fields.detail = message;
  } else {
    fields.dropped = true;
  }

  switch (level) {
    case 'error':
      logger.error(fields);
      break;
    case 'warn':
      logger.warn(fields);
      break;
    case 'info':
      logger.log(fields);
      break;
    default:
      logger.debug(fields);
  }
}
