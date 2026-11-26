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
  await page.getByRole('checkbox', { name: /同意/ }).check();
  await page.getByRole('button', { name: '登録する' }).click();
  await expect(page).toHaveURL(/\/home\/?$/);
}

// ページ全体が画面幅より横に広がっていないか（横スクロールが出ていないか）
async function overflowX(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

test('A3 主な画面が 390px で横スクロールしない', async ({ page }) => {
  await signUp(page);
  for (const path of ['/home/', '/log/', '/friends/', '/me/', '/me/posts/', '/me/profile/', '/settings/', '/exercises/', '/rest/']) {
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
  // 画面の下端にぴったり合わせて見せたとき、小数のずれ（844.06 など）で落ちないよう 1px の余裕を持たせる
  expect(box!.y + box!.height).toBeLessThanOrEqual(845);
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
  for (const path of ['/exercises/', '/log/', '/home/', '/me/']) {
    await page.goto(path);
    await page.getByRole('heading', { level: 1 }).first().waitFor({ state: 'attached' });
    await page.waitForTimeout(500);
  }
  expect(warnings).toEqual([]);
});

// L3: スマホの横向き（844×390）で、今日の画面の主ボタンが下のタブに隠れずに最初の画面に入る
test('L3 横向き 844×390 で、今日の主ボタンが最初の画面に入る（始める前・記録中）', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await signUp(page);
  await page.goto('/log/');
  const check = async (name: string) => {
    const link = page.getByRole('link', { name });
    await expect(link).toBeVisible();
    const box = (await link.boundingBox())!;
    const nav = (await page.getByRole('navigation', { name: 'メイン' }).boundingBox())!;
    expect(box.y + box.height, `${name} の下端`).toBeLessThanOrEqual(nav.y);
  };
  await check('種目を選ぶ');
  await page.goto('/exercises/');
  await page.locator('a[href^="/record?exercise="]').first().click();
  // 結果シートは保存を待たずに出るので、保存の応答を待ってから移る
  const saved = page.waitForResponse((r) => r.request().method() === 'POST' && /\/records\/[^/]+\/sets$/.test(new URL(r.url()).pathname) && r.ok());
  let listed = 0;
  let afterSave = false;
  page.on('response', (r) => {
    if (r.request().method() === 'POST' && /\/sets$/.test(new URL(r.url()).pathname)) afterSave = true;
    else if (afterSave && r.request().method() === 'GET' && new URL(r.url()).pathname === '/api/records' && r.ok()) listed++;
  });
  await page.getByRole('button', { name: 'できた' }).click();
  await saved;
  // 一覧は 30 秒キャッシュされる。読み直す前に、保存のあとの取り直しが済んで端末に書かれるのを待つ
  await expect.poll(() => listed).toBeGreaterThan(0);
  await page.waitForTimeout(500);
  await expect(page.getByTestId('result-sheet')).toBeVisible();
  await page.goto('/log/');
  await check('続ける');
});

// L11: 体重のものさしの目盛り。今の値の数字が、真ん中の針の位置に見える（jsdom では位置を測れない）
test('L11 体重のものさしで、今の値の目盛りの数字が針の位置にある', async ({ page }) => {
  await signUp(page);
  await page.goto('/me/body/');
  const slider = page.getByRole('slider', { name: '体重（kg）' });
  await expect(slider).toBeVisible();
  const label = page.getByTestId('ruler-label').filter({ hasText: /^60$/ });
  await expect(label).toBeInViewport();
  const s = (await slider.boundingBox())!;
  const l = (await label.boundingBox())!;
  expect(Math.abs(l.x + l.width / 2 - (s.x + s.width / 2))).toBeLessThanOrEqual(3);
});

// 200% 拡大相当（195×422）で今日の画面が横にはみ出さない。高さが低いので、横向き用の詰め方（short:）も効く幅
test('195×422 で、今日の画面が横にはみ出さない', async ({ page }) => {
  await signUp(page);
  await page.setViewportSize({ width: 195, height: 422 });
  await page.goto('/log/');
  await expect(page.getByRole('link', { name: 'ランを記録' })).toBeVisible();
  const box = (await page.getByRole('link', { name: 'ランを記録' }).boundingBox())!;
  expect(box.x + box.width).toBeLessThanOrEqual(195);
  expect(await overflowX(page)).toBeLessThanOrEqual(0);
});

// 色の面の上の注記は、面の字の色（白）のまま（text-note が色まで付けて灰色になっていた）
test('今日のカードの注記は、ティールの面の上で白い字', async ({ page }) => {
  await signUp(page);
  await page.goto('/log/');
  await expect(page.getByText(/お試しの値です/)).toHaveCSS('color', 'rgb(255, 255, 255)');
});
