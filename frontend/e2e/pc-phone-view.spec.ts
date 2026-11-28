import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';

// 02-9 ⑪: PC 幅で「スマホと同じ画面」に切り替えられる。左メニュー・右の仲間が消え、中央の幅が430px以内になる。
// 端末に覚えるので、リロードしても同じ表示のまま。1024px 未満ではボタンが出ない。
test.use({ viewport: { width: 1280, height: 800 } });

async function signUp(page: Page): Promise<void> {
  await page.goto('/signup/');
  await page.getByLabel('表示名').fill('E2E太郎');
  await page.getByLabel('メールアドレス').fill(`e2e-pcview-${randomUUID().slice(0, 8)}@example.com`);
  await page.getByLabel(/^パスワード/).fill('e2e-password-1234');
  await page.getByRole('checkbox', { name: /同意/ }).check();
  await page.getByRole('button', { name: '登録する' }).click();
  await expect(page).toHaveURL(/\/home\/?$/);
}

const mainWidth = async (page: Page) => (await page.locator('main').first().boundingBox())?.width ?? 0;

test('PC 幅でスマホと同じ画面に切り替えられ、リロードしても覚えていて、戻せる', async ({ page }) => {
  await signUp(page);
  const side = page.getByRole('complementary', { name: '仲間の今日' });
  const toPhone = page.getByRole('button', { name: /スマホと同じ画面に切り替える/ });
  const toPc = page.getByRole('button', { name: /PC 表示に切り替える/ });

  // 既定は PC 表示（右の列があり、中央は430pxより広い）
  await expect(side).toBeVisible();
  expect(await mainWidth(page)).toBeGreaterThan(430);

  await toPhone.click();
  await expect(side).toHaveCount(0);
  expect(await mainWidth(page)).toBeLessThanOrEqual(430);
  await expect(toPc).toBeVisible();

  await page.reload();
  await expect(toPc).toBeVisible();
  await expect(side).toHaveCount(0);
  expect(await mainWidth(page)).toBeLessThanOrEqual(430);

  await toPc.click();
  await expect(side).toBeVisible();
  expect(await mainWidth(page)).toBeGreaterThan(430);
});

test('1024px 未満では切替ボタンが出ない', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signUp(page);
  await expect(page.getByRole('button', { name: /スマホと同じ画面に切り替える|PC 表示に切り替える/ })).toHaveCount(0);
});
