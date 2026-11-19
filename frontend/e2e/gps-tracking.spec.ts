import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';

// GPS で記録する（#274）。本物のブラウザ・本物の画面で、開始→位置が届く→終了→入力欄に入る→保存、までを通す。
// 位置情報は端末ごとに違い実時間で届くので、偽の位置情報（window.__emit）と偽の時計（page.clock）に差し替える。
// 実際の GPS の精度・画面が消えたときの挙動は、実機でしか確かめられない
test.use({ viewport: { width: 390, height: 844 } });

test('GPS で記録して終了すると、距離と時間が入力欄に入り、保存できる', async ({ page }) => {
  const start = new Date('2026-11-19T06:00:00Z');
  await page.clock.install({ time: start });
  await page.addInitScript(() => {
    type Cb = (p: unknown) => void;
    let cb: Cb | null = null;
    const w = window as unknown as { __emit: (northM: number) => void };
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        watchPosition: (s: Cb) => {
          cb = s;
          return 1;
        },
        clearWatch: () => {
          cb = null;
        },
      },
    });
    w.__emit = (northM: number) =>
      cb?.({ coords: { latitude: northM / ((Math.PI / 180) * 6_371_008.8), longitude: 139.7, accuracy: 5 }, timestamp: Date.now() });
  });

  await page.goto('/signup/');
  await page.getByLabel('表示名').fill('E2E太郎');
  await page.getByLabel('メールアドレス').fill(`e2e-gps-${randomUUID().slice(0, 8)}@example.com`);
  await page.getByLabel(/^パスワード/).fill('e2e-password-1234');
  await page.getByRole('button', { name: '登録する' }).click();
  await expect(page).toHaveURL(/\/today\/?$/);

  await page.goto('/run/');
  await page.getByRole('button', { name: 'GPS で記録する' }).click();
  await expect(page.getByText('GPS をさがしています')).toBeVisible();

  // 10秒ごとに 30m（時速 10.8km）を 8 回。2.1 分のうち 240m 走る
  for (let i = 0; i <= 8; i++) {
    await page.evaluate((m) => (window as unknown as { __emit: (n: number) => void }).__emit(m), i * 30);
    await page.clock.runFor(10_000);
  }
  await expect(page.getByTestId('gps-distance')).toHaveText('0.24');
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  await page.screenshot({ path: 'test-results/gps-tracking-390.png' });

  await page.getByRole('button', { name: '終了' }).click();
  await expect(page.getByRole('textbox', { name: '距離（km）' })).toHaveValue('0.24');
  await expect(page.getByRole('textbox', { name: '時間（分）' })).toHaveValue('1');
  await expect(page.getByRole('textbox', { name: '時間（秒）' })).toHaveValue('30');
  await expect(page.getByText('GPS の記録を入れました')).toBeVisible();

  await page.getByRole('button', { name: '保存する' }).click();
  // B10: 画面の上に「電波なし・送ったよ」の帯（role=status・ふだんは空）が入ったので、先頭の status ではなく、保存した結果の板を指す
  await expect(page.getByRole('status').filter({ hasText: 'RUN' })).toBeVisible();
  await expect(page.getByTestId('pace')).toBeVisible();
});
