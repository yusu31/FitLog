import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { errorCode } from './error-code.js';

type Res = { status: (code: number) => { json: (body: unknown) => void } };

// すべての例外を、設計の形（code・message・details。docs/design.md 5章）で返す。
// 想定外のエラーは、Nest の既定だとエラー全体をログに出す。drizzle のエラーは message に SQL の引数
// （セッションのトークン・メールアドレス・招待リンクの値など）を含むので、名前と原因の印だけを出す。
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Res>();

    if (exception instanceof HttpException) {
      res.status(exception.getStatus()).json(toBody(exception));
      return;
    }

    const name = exception instanceof Error ? exception.name : typeof exception;
    this.logger.error(`想定外のエラー: ${name} (${errorCode(exception)})`);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      code: 'INTERNAL_ERROR',
      message: 'サーバーでエラーが起きました',
      details: null,
    });
  }
}

function toBody(exception: HttpException): { code: string; message: string; details: unknown } {
  const response = exception.getResponse();
  if (typeof response === 'object' && response !== null && typeof (response as { code?: unknown }).code === 'string') {
    return response as { code: string; message: string; details: unknown };
  }
  const code = HttpStatus[exception.getStatus()] ?? 'ERROR';
  const raw = typeof response === 'string' ? response : (response as { message?: unknown }).message;
  // class-validator のように、項目ごとの理由が配列で来るときは details に入れる
  if (Array.isArray(raw)) {
    return { code, message: '入力が正しくありません', details: raw };
  }
  return { code, message: typeof raw === 'string' ? raw : exception.message, details: null };
}
