import type { LoggerService } from '@nestjs/common';
import { requestContext } from './request-context.js';

// 構造化ログ（1行 = 1つの JSON）。フィールドの名前は docs/operations.md 1-1 に合わせる。
// NestJS 標準の ConsoleLogger({ json: true }) は、レベルが log・時刻が数値・requestId を付けられないので使わない（判断ログ 02-1-3）。
// 出さないもの（パスワード・Cookie・メールアドレス等）は、呼ぶ側が渡さない（operations.md 1-3）。ここで消す方式にはしない。

type Level = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
const ORDER: Record<Level, number> = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };
// ログの出力に使う名前を予約する。呼ぶ側のオブジェクトで上書きされない
const RESERVED = new Set(['time', 'level']);

export function parseLevel(value: string | undefined): Level {
  const upper = (value ?? 'INFO').toUpperCase();
  return upper in ORDER ? (upper as Level) : 'INFO';
}

const looksLikeStack = (s: string) => /^\w*Error\b/.test(s) || s.includes('\n    at ');

export class JsonLogger implements LoggerService {
  constructor(
    private readonly minLevel: Level = 'INFO',
    private readonly write: (line: string) => void = (line) => process.stdout.write(line),
  ) {}

  log(message: unknown, ...params: unknown[]) {
    this.emit('INFO', message, params);
  }
  error(message: unknown, ...params: unknown[]) {
    this.emit('ERROR', message, params);
  }
  warn(message: unknown, ...params: unknown[]) {
    this.emit('WARN', message, params);
  }
  debug(message: unknown, ...params: unknown[]) {
    this.emit('DEBUG', message, params);
  }
  verbose(message: unknown, ...params: unknown[]) {
    this.emit('DEBUG', message, params);
  }
  fatal(message: unknown, ...params: unknown[]) {
    this.emit('ERROR', message, params);
  }

  private emit(level: Level, message: unknown, params: unknown[]) {
    if (ORDER[level] < ORDER[this.minLevel]) return;

    const fields: Record<string, unknown> = {};
    let msg: string;
    if (message instanceof Error) {
      msg = message.message;
      fields.err = { name: message.name, stack: message.stack };
    } else if (message !== null && typeof message === 'object') {
      const { msg: m, message: m2, ...rest } = message as Record<string, unknown>;
      const text = m ?? m2;
      msg = typeof text === 'string' ? text : '';
      Object.assign(fields, rest);
    } else {
      msg = String(message);
    }

    // Nest は最後の文字列に「どのクラスが出したか」（context）を付ける。error のときは直前に stack が来ることがある
    const strings = params.filter((p): p is string => typeof p === 'string');
    for (const p of params) {
      if (p !== null && typeof p === 'object') Object.assign(fields, p);
    }
    if (strings.length > 0) {
      const last = strings[strings.length - 1];
      if (level === 'ERROR' && strings.length === 1 && looksLikeStack(last)) {
        fields.err = { ...(fields.err as object | undefined), stack: last };
      } else {
        fields.context = last;
        if (strings.length > 1) fields.err = { ...(fields.err as object | undefined), stack: strings[0] };
      }
    }

    const entry: Record<string, unknown> = { time: new Date().toISOString(), level, msg };
    const requestId = requestContext.getStore()?.requestId;
    if (requestId) entry.requestId = requestId;
    for (const [k, v] of Object.entries(fields)) {
      if (!RESERVED.has(k)) entry[k] = v;
    }
    this.write(JSON.stringify(entry) + '\n');
  }
}
