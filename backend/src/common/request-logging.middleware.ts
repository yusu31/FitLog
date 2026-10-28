import { Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { requestContext } from './request-context.js';

// X-Request-Id が来ていて形が正しければそれを使い、なければ UUID を作る（docs/operations.md 1-2）。
// 形を検査するのは、ログに好きな文字列（改行など）を入れられないようにするため。
const VALID_ID = /^[A-Za-z0-9._-]{8,64}$/;

const logger = new Logger('Http');

// ステータスが決まった後に1行出す（docs/design.md「ログ」: リクエスト ID・ユーザー ID・パス・ステータス・処理時間）。
// パスは「実際のパス」ではなく「パスの型」を出す。招待リンクの値などが入っているため（operations.md 1-3）。
export function requestLoggingMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.headers['x-request-id'];
  const requestId = typeof incoming === 'string' && VALID_ID.test(incoming) ? incoming : randomUUID();
  res.setHeader('X-Request-Id', requestId);
  const startedAt = performance.now();

  res.on('finish', () => {
    // better-auth の道（/api/auth/*）は Nest のルートではないので、型の代わりにクエリを除いたパスを出す（値は入らない）
    // 連携部品の「全部のパスにかかる」関門は '*path' という名前なので、ルートとして数えない（どのルートにも当たらなかった扱い）
    const routePath = (req.route as { path?: unknown } | undefined)?.path;
    const matched = typeof routePath === 'string' && !routePath.startsWith('*') ? routePath : undefined;
    const route = matched ?? (req.originalUrl.startsWith('/api/auth/') ? req.originalUrl.split('?')[0] : '(unmatched)');
    const fields = {
      msg: 'request',
      event: 'http.request',
      requestId,
      userId: (req as Request & { user?: { id?: string } }).user?.id,
      method: req.method,
      route,
      status: res.statusCode,
      durationMs: Math.round(performance.now() - startedAt),
    };
    if (res.statusCode >= 500) logger.error(fields);
    else logger.log(fields);
  });

  requestContext.run({ requestId }, next);
}
