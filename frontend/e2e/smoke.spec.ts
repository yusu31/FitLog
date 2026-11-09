import { expect, test } from '@playwright/test';

// スモーク: 新規登録 → 今日の画面が出る。
// ブラウザ → /api/auth/sign-up/email（SHA-256 つきの通信）→ API → DB → Cookie → 今日の画面、を一気に通す。
// 単体テストでは見つからなかった「通信に SHA-256 が付かず 403」のような、つなぎ目の不具合を見つけるのが目的。
test('新規登録すると、今日の画面が開く', async ({ page }) => {
  // 毎回別のメール（再実行しても「登録済み」にならない）
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;

  await page.goto('/signup/');
  await page.getByLabel('表示名').fill('E2E太郎');
  await page.getByLabel('メールアドレス').fill(email);
  await page.getByLabel(/^パスワード/).fill('e2e-password-1234');

  // ローカルの API は SHA-256 を要求しない（公開環境の Lambda だけが要求する）ので、送られたか自分で確かめる。
  // 付いていないと公開環境では 403 になる（Issue #162）
  const signUpRequest = page.waitForRequest((req) => req.url().includes('/api/auth/sign-up/email') && req.method() === 'POST');
  await page.getByRole('button', { name: '登録する' }).click();
  const sent = await signUpRequest;
  expect(await sent.headerValue('x-amz-content-sha256')).toMatch(/^[0-9a-f]{64}$/);

  await expect(page).toHaveURL(/\/today\/?$/);
  await expect(page.getByRole('heading', { level: 1, name: 'きょう' })).toBeAttached();
});
