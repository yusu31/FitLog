import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installBodyHash } from './body-hash';

// 'hello' の SHA-256（16進）。https://en.wikipedia.org/wiki/SHA-2 の定番の値
const HELLO_SHA256 = '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824';
// 空文字の SHA-256
const EMPTY_SHA256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

describe('installBodyHash（/api/* への本文つきリクエストに SHA-256 を付ける）', () => {
  const original = globalThis.fetch;
  let received: { input: RequestInfo | URL; init?: RequestInit }[];

  beforeEach(() => {
    received = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      received.push({ input, init });
      return new Response('{}');
    }) as typeof fetch;
    installBodyHash();
  });
  afterEach(() => {
    globalThis.fetch = original;
  });

  const sentHash = () => new Headers(received[0].init?.headers).get('x-amz-content-sha256');

  it('POST の JSON 本文のハッシュを x-amz-content-sha256 に入れる', async () => {
    await fetch('/api/records', { method: 'POST', body: 'hello' });
    expect(sentHash()).toBe(HELLO_SHA256);
  });

  it('PATCH・PUT・DELETE でも、本文があれば付ける', async () => {
    for (const method of ['PATCH', 'PUT', 'DELETE']) {
      received = [];
      await fetch('/api/records/1', { method, body: 'hello' });
      expect(sentHash()).toBe(HELLO_SHA256);
    }
  });

  it('本文が空文字でも付ける（空のハッシュ）', async () => {
    await fetch('/api/auth/sign-out', { method: 'POST', body: '' });
    expect(sentHash()).toBe(EMPTY_SHA256);
  });

  it('本文なしの POST にも付ける（Lambda は本文なしでも署名の検査をするため、空のハッシュ）', async () => {
    await fetch('/api/auth/sign-out', { method: 'POST' });
    expect(sentHash()).toBe(EMPTY_SHA256);
  });

  it('GET には付けない', async () => {
    await fetch('/api/records');
    expect(sentHash()).toBeNull();
  });

  it('/api/ 以外（S3 への直接アップロードなど）には付けない', async () => {
    await fetch('https://example-bucket.s3.amazonaws.com/', { method: 'POST', body: 'hello' });
    await fetch('/serwist/sw.js', { method: 'POST', body: 'hello' });
    expect(received.every((r) => !new Headers(r.init?.headers).has('x-amz-content-sha256'))).toBe(true);
  });

  it('同じサイトの絶対 URL（http://localhost/api/...）にも付ける', async () => {
    await fetch(`${window.location.origin}/api/records`, { method: 'POST', body: 'hello' });
    expect(sentHash()).toBe(HELLO_SHA256);
  });

  it('呼び出し側のヘッダーは残す', async () => {
    await fetch('/api/records', { method: 'POST', body: 'hello', headers: { 'Content-Type': 'application/json' } });
    expect(new Headers(received[0].init?.headers).get('content-type')).toBe('application/json');
    expect(sentHash()).toBe(HELLO_SHA256);
  });

  it('すでに付いていれば上書きしない', async () => {
    await fetch('/api/records', { method: 'POST', body: 'hello', headers: { 'x-amz-content-sha256': 'abc' } });
    expect(sentHash()).toBe('abc');
  });

  it('2回呼んでも二重にかぶせない（ハッシュは1回だけ計算される）', async () => {
    installBodyHash();
    await fetch('/api/records', { method: 'POST', body: 'hello' });
    expect(received).toHaveLength(1);
    expect(sentHash()).toBe(HELLO_SHA256);
  });

  it('ブラウザの暗号機能（crypto.subtle）が無い環境では、ヘッダー無しでそのまま送る', async () => {
    const subtle = Object.getOwnPropertyDescriptor(globalThis.crypto, 'subtle');
    Object.defineProperty(globalThis.crypto, 'subtle', { value: undefined, configurable: true });
    try {
      await fetch('/api/records', { method: 'POST', body: 'hello' });
      expect(sentHash()).toBeNull();
    } finally {
      if (subtle) Object.defineProperty(globalThis.crypto, 'subtle', subtle);
      else delete (globalThis.crypto as { subtle?: unknown }).subtle;
    }
  });
});
