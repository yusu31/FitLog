import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';

// A3: 幅 390px（一般的なスマホ）での見切れ・横スクロール・結果シートのはみ出しを実画面で測る。
// 文字拡大・横向きは端末が要るので本人の確認（A5）。ここは Chromium の 390×844 だけ。
test.use({ viewport: { width: 390, height: 844 } });

async function signUp(page: Page): Promise<void> {
  await page.goto('/signup/');
  await page.getByLabel('表示名').fill('E2E太郎');
  await page.getByLabel('メールアドレス').fill(`e2e-vp390-${randomUUID().slice(0, 8)}@example.com`);
  await page.getByLabel(/^パスワード/).fill('e2e-password-1234');
  await page.getByRole('button', { name: '登録する' }).click();
  await expect(page).toHaveURL(/\/today\/?$/);
}

// ページ全体が画面幅より横に広がっていないか（横スクロールが出ていないか）
async function overflowX(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

test('A3 主な画面が 390px で横スクロールしない', async ({ page }) => {
  await signUp(page);
  for (const path of ['/today/', '/friends/', '/me/', '/settings/', '/exercises/', '/rest/']) {
    await page.goto(path);
    await page.getByRole('heading', { level: 1 }).first().waitFor({ state: 'attached' });
    expect(await overflowX(page), `${path} の横はみ出し(px)`).toBeLessThanOrEqual(0);
  }
});

test('A3 結果シートが 390px で横にはみ出さず、流れの中で見切れない', async ({ page }) => {
  await signUp(page);
  await page.goto('/exercises/');
  await page.locator('a[href^="/record?exercise="]').first().click();
  await expect(page).toHaveURL(/\/record\/?\?exercise=/);
  await page.getByRole('button', { name: 'できた' }).click();
  const sheet = page.getByTestId('result-sheet');
  await expect(sheet).toBeVisible();
  // 出現アニメーション（300ms）が終わるのを待ってから測る
  await page.waitForTimeout(500);
  // 初めての記録ならスタンプのお祝い（D5 PR-2）が少し遅れて足されて板が伸びる。出るなら出たあとの高さで測る（出なくても進む）
  await page.getByTestId('new-stamps').waitFor({ timeout: 1500 }).catch(() => {});

  // B04: 結果の板は画面に固定せず、セット一覧の流れの中に出る。そのため画面の下にあることがあり、
  // 「見える位置までスクロールすれば、板の全体が画面（390×844）に収まる」ことを守る
  await sheet.scrollIntoViewIfNeeded();
  const box = await sheet.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height).toBeLessThanOrEqual(844);
  // 中身の横はみ出し（文字・体の図が枠より広がっていないか）
  const inner = await sheet.evaluate((el) => el.scrollWidth - el.clientWidth);
  expect(inner, '結果シート内の横はみ出し(px)').toBeLessThanOrEqual(0);
  expect(await overflowX(page)).toBeLessThanOrEqual(0);
  await page.screenshot({ path: 'test-results/a3-result-sheet-390.png' });
  console.log(`A3 結果シート: x=${box!.x} w=${box!.width} h=${box!.height} (画面 390×844)`);
});

// #267（S3）で、端末の控えを描画中に読んだために、控えのある端末だけ最初の描画が HTML と食い違った（hydration mismatch）。
// 控えがある状態（登録直後）で画面を開き直し、ずれの警告が出ないことを守る
test('控えのある端末で画面を開き直しても、描画のずれ（hydration）の警告が出ない', async ({ page }) => {
  const warnings: string[] = [];
  page.on('console', (m) => {
    if (/hydrat/i.test(m.text())) warnings.push(m.text().slice(0, 120));
  });
  page.on('pageerror', (e) => {
    if (/hydrat/i.test(e.message)) warnings.push(e.message.slice(0, 120));
  });
  await signUp(page);
  for (const path of ['/exercises/', '/today/', '/me/']) {
    await page.goto(path);
    await page.getByRole('heading', { level: 1 }).first().waitFor({ state: 'attached' });
    await page.waitForTimeout(500);
  }
  expect(warnings).toEqual([]);
});
