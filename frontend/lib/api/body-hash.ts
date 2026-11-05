// 公開環境では、API の Lambda は CloudFront の裏の「Function URL（認証つき）」で動く。
// POST/PUT などの本文があるリクエストは、本文の SHA-256 が x-amz-content-sha256 ヘッダーに入っていないと拒否される
// （docs/infrastructure.md 3章。AWS 公式: Restricting access to a Lambda function URL origin）。
// orval の生成物も better-auth のクライアントも、どちらも同じ globalThis.fetch を使うので、fetch を1か所だけ包んで付ける。

const HEADER = 'x-amz-content-sha256';
const WITH_BODY_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const WRAPPED = Symbol.for('fitlog.bodyHash');

const toHex = (buf: ArrayBuffer) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');

function urlOf(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

// 同じサイトの /api/ 以下か（S3 への直接アップロードなど、別の宛先には付けない）
function isApiUrl(raw: string): boolean {
  try {
    const url = new URL(raw, window.location.origin);
    return url.origin === window.location.origin && url.pathname.startsWith('/api/');
  } catch {
    return false;
  }
}

// 本文を bytes にする。ハッシュを計算できない形（FormData・ストリーム）は null
async function bodyBytes(input: RequestInfo | URL, init?: RequestInit): Promise<BufferSource | null> {
  const body = init?.body ?? (input instanceof Request ? await input.clone().arrayBuffer() : undefined);
  if (body === undefined || body === null) return new Uint8Array(0);
  if (typeof body === 'string') return new TextEncoder().encode(body);
  if (body instanceof URLSearchParams) return new TextEncoder().encode(body.toString());
  if (body instanceof ArrayBuffer || ArrayBuffer.isView(body)) return body as BufferSource;
  if (body instanceof Blob) return body.arrayBuffer();
  return null;
}

export function installBodyHash(): void {
  // ビルド時（Node。window が無い）は何もしない
  if (typeof window === 'undefined') return;
  const base = globalThis.fetch;
  if (typeof base !== 'function' || (base as unknown as Record<symbol, boolean>)[WRAPPED]) return;

  const wrapped = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
    // crypto.subtle は HTTPS（と localhost）でしか使えない。使えない環境ではヘッダー無しでそのまま送る
    if (!WITH_BODY_METHODS.has(method) || !isApiUrl(urlOf(input)) || !globalThis.crypto?.subtle) {
      return base(input, init);
    }
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    if (headers.has(HEADER)) return base(input, init);
    const bytes = await bodyBytes(input, init);
    if (bytes === null) return base(input, init);
    headers.set(HEADER, toHex(await globalThis.crypto.subtle.digest('SHA-256', bytes)));
    return base(input, { ...init, headers });
  };
  (wrapped as unknown as Record<symbol, boolean>)[WRAPPED] = true;
  globalThis.fetch = wrapped as typeof fetch;
}
