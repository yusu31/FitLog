import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';

// 日本縦断の地図（#272）。本物のブラウザで、本物の地図の部品（MapLibre の canvas）が描かれることと、スマホ幅ではみ出さないことを確かめる。
// 地図の中身（地名・線の色）は外部のタイル配信に依存するので、ここでは「地図が出る・出せなければ理由が出る」までを守る。見た目は撮った画像を目で見る
test.use({ viewport: { width: 390, height: 844 } });

test('記録のまとめに、日本縦断の地図が出る（canvas があり、横にはみ出さない）', async ({ page }) => {
  await page.goto('/signup/');
  await page.getByLabel('表示名').fill('E2E太郎');
  await page.getByLabel('メールアドレス').fill(`e2e-trek-${randomUUID().slice(0, 8)}@example.com`);
  await page.getByLabel(/^パスワード/).fill('e2e-password-1234');
  await page.getByRole('checkbox', { name: /同意/ }).check();
  await page.getByRole('button', { name: '登録する' }).click();
  await expect(page).toHaveURL(/\/today\/?$/);

  await page.goto('/me/stats/');
  // 帯はいつも出る。地図は押して開いたときだけ（#439）
  await page.getByRole('button', { name: /^日本縦断/ }).click();
  const map = page.getByRole('img', { name: /鹿児島から北へ進んだ位置/ });
  await expect(map).toBeVisible();
  await expect(map.locator('canvas.maplibregl-canvas')).toBeVisible({ timeout: 15_000 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  // 195px 幅（拡大表示）でも、帯の文が1文字ずつ縦に並ばない
  await page.setViewportSize({ width: 195, height: 422 });
  expect((await page.getByText('日本縦断', { exact: true }).boundingBox())!.height).toBeLessThan(40);
  // 同じ幅で、「次へ」の丸が画面の右にはみ出さず、スタンプ帳の名前も縦書きにならない（#445）
  const next = (await page.getByRole('button', { name: '次へ' }).boundingBox())!;
  expect(next.x + next.width).toBeLessThanOrEqual(195);
  expect((await page.getByTestId('all-stamps').locator('li').first().boundingBox())!.height).toBeLessThan(120);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(5000); // タイルの読み込みを待つ（撮影用）
  await map.screenshot({ path: 'test-results/japan-trek-map-390.png' });
});

test('ラン画面の上に日本縦断への入口があり、押すと記録のまとめ（地図）へ行く', async ({ page }) => {
  await page.goto('/signup/');
  await page.getByLabel('表示名').fill('E2E太郎');
  await page.getByLabel('メールアドレス').fill(`e2e-trek2-${randomUUID().slice(0, 8)}@example.com`);
  await page.getByLabel(/^パスワード/).fill('e2e-password-1234');
  await page.getByRole('checkbox', { name: /同意/ }).check();
  await page.getByRole('button', { name: '登録する' }).click();
  await expect(page).toHaveURL(/\/today\/?$/);

  await page.goto('/run/');
  await page.getByRole('link', { name: '日本縦断' }).click();
  // 「日本縦断」の入口は ?metric=m#japan-trek へ行く。ラン（日本縦断）が選ばれた状態で、地図まで出る（L6・D4-4）
  await expect(page).toHaveURL(/\/me\/stats\/?\?metric=m#japan-trek$/);
  await expect(page.getByRole('button', { name: 'ラン', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('img', { name: /鹿児島から北へ進んだ位置/ })).toBeVisible();
});
