import { expect, test, type Page } from '@playwright/test';

// 利用者の流れ（docs/testing-design.md 3-9・3-10 の E2E 指定）。認証まわりと、登録直後の最初の1セット。
const PASSWORD = 'e2e-password-1234';
const newEmail = (tag: string) => `e2e-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;

async function signUp(page: Page, email: string): Promise<void> {
  await page.goto('/signup/');
  await page.getByLabel('表示名').fill('E2E太郎');
  await page.getByLabel('メールアドレス').fill(email);
  await page.getByLabel(/^パスワード/).fill(PASSWORD);
  await page.getByRole('button', { name: '登録する' }).click();
  await expect(page).toHaveURL(/\/today\/?$/);
}

async function logOut(page: Page): Promise<void> {
  await page.goto('/settings/');
  await page.getByRole('button', { name: 'ログアウト' }).click();
  await expect(page).toHaveURL(/\/login\/?/);
}

test.describe('認証の流れ', () => {
  test('T-AUTH-03 ログアウトすると、ログイン画面に移り、保護された画面は開けない', async ({ page }) => {
    await signUp(page, newEmail('logout'));
    await logOut(page);
    await page.goto('/me/');
    await expect(page).toHaveURL(/\/login\/?\?next=/);
  });

  test('T-AUTH-04 未ログインで開いた画面に、ログイン後に戻る', async ({ page }) => {
    const email = newEmail('next');
    await signUp(page, email);
    await logOut(page);

    await page.goto('/me/');
    await expect(page).toHaveURL(/\/login\/?\?next=%2Fme/);
    await page.getByLabel('メールアドレス').fill(email);
    await page.getByLabel('パスワード').fill(PASSWORD);
    await page.getByRole('button', { name: 'ログイン', exact: true }).click();
    await expect(page).toHaveURL(/\/me\/?$/);
  });

  test('T-AUTH-01 ログインの失敗は、メール違い・パスワード違いで同じ文言', async ({ page }) => {
    const email = newEmail('wrong');
    await signUp(page, email);
    await logOut(page);

    const messages: string[] = [];
    for (const [mail, password] of [
      [newEmail('nobody'), PASSWORD],
      [email, 'wrong-password-0000'],
    ]) {
      await page.goto('/login/');
      await page.getByLabel('メールアドレス').fill(mail);
      await page.getByLabel('パスワード').fill(password);
      await page.getByRole('button', { name: 'ログイン', exact: true }).click();
      const alert = page.locator('form [role="alert"]');
      await expect(alert).toBeVisible();
      messages.push((await alert.textContent()) ?? '');
    }
    expect(messages[0]).toBe('メールアドレスかパスワードが違います');
    expect(messages[1]).toBe(messages[0]);
  });

  test('T-AUTH-02 同じメールで再登録すると「登録済み」と出る', async ({ page }) => {
    const email = newEmail('dup');
    await signUp(page, email);
    await logOut(page);

    await page.goto('/signup/');
    await page.getByLabel('表示名').fill('E2E次郎');
    await page.getByLabel('メールアドレス').fill(email);
    await page.getByLabel(/^パスワード/).fill(PASSWORD);
    await page.getByRole('button', { name: '登録する' }).click();
    await expect(page.locator('form [role="alert"]')).toContainText('登録済み');
  });
});

test('T-FIRST-01 登録した直後の人が、今日 → 種目を選ぶ → できた の3画面で最初の1セットを記録できる', async ({ page }) => {
  await signUp(page, newEmail('first'));

  // 画面1: 今日
  await page.getByRole('link', { name: '種目を選ぶ' }).click();
  // 画面2: 種目の一覧（お試しの値つきの最初の1件を選ぶ）
  await expect(page).toHaveURL(/\/exercises\/?$/);
  await page.locator('a[href^="/record?exercise="]').first().click();
  // 画面3: 記録。「できた」1タップで結果が出る
  await expect(page).toHaveURL(/\/record\/?\?exercise=/);
  await page.getByRole('button', { name: 'できた' }).click();
  await expect(page.getByTestId('result-sheet')).toBeVisible();

  // 保存された: 今日の画面に戻ると、その種目が「できた」になる
  await page.goto('/today/');
  await expect(page.getByText('できた', { exact: true }).first()).toBeVisible();
});
