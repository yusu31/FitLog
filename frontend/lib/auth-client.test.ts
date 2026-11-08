import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// better-auth のクライアントは、作った時点の fetch を握ってしまう（customFetchImpl: fetch）。
// 画面は installBodyHash() で fetch を包むので、包む前に握られると SHA-256 が付かず、公開環境の Lambda に 403 で断られる（Issue #162）。
// 読み込み順に左右されないよう、呼ぶたびに「今の fetch」を使うことを確かめる。
describe('authClient（作ったあとに fetch が差し替えられても、差し替え後の fetch で送る）', () => {
  const original = globalThis.fetch;
  const ok = () => new Response(JSON.stringify({ token: 't', user: { id: 'u1' } }), { headers: { 'content-type': 'application/json' } });

  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    globalThis.fetch = original;
  });

  it('auth-client を読み込んだあとに差し替えた fetch が、ログインの送信に使われる', async () => {
    const before = vi.fn(async () => ok());
    const after = vi.fn(async () => ok());

    globalThis.fetch = before as unknown as typeof fetch;
    const { authClient } = await import('./auth-client');
    globalThis.fetch = after as unknown as typeof fetch; // installBodyHash() が fetch を包むのと同じ状況

    await authClient.signIn.email({ email: 'a@example.com', password: 'password-1234' });

    expect(after).toHaveBeenCalledTimes(1);
    expect(before).not.toHaveBeenCalled();
  });
});
