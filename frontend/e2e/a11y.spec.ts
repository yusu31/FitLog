import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// アクセシビリティ検査（docs/testing-design.md 1-1）。axe-core で WCAG 2.1 A/AA の機械で見つかる違反を調べる。
// 読み上げの自然さ・キーボードだけの操作など、機械で見つからないものは手動で確かめる。
// 注意: 色の差（color-contrast）は、背景に擬似要素の飾りがある画面では axe が「判定不能（incomplete）」に回し、違反にも合格にも数えない（ログイン画面で確認）。
// 色の差は docs/screen-design.md の実測表で別に守る。
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

async function expectNoViolations(page: Page, name: string): Promise<void> {
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  // 失敗したとき、どの規則がどの要素で破られたかが読めるようにする
  const summary = violations.map((v) => `${v.id}（${v.impact}）: ${v.nodes.map((n) => n.target.join(' ')).join(' / ')}`);
  expect(summary, `${name} のアクセシビリティ違反`).toEqual([]);
}

test.describe('アクセシビリティ（ログイン前）', () => {
  for (const path of ['/login/', '/signup/']) {
    test(`${path} に違反がない`, async ({ page }) => {
      await page.goto(path);
      await page.getByRole('heading', { level: 1 }).waitFor({ state: 'attached' });
      await expectNoViolations(page, path);
    });
  }
});

test.describe('アクセシビリティ（ログイン後）', () => {
  test.beforeEach(async ({ page }) => {
    const email = `e2e-a11y-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
    await page.goto('/signup/');
    await page.getByLabel('表示名').fill('E2E太郎');
    await page.getByLabel('メールアドレス').fill(email);
    await page.getByLabel(/^パスワード/).fill('e2e-password-1234');
    await page.getByRole('button', { name: '登録する' }).click();
    await expect(page).toHaveURL(/\/today\/?$/);
  });

  for (const path of ['/today/', '/friends/', '/me/', '/settings/', '/exercises/', '/rest/']) {
    test(`${path} に違反がない`, async ({ page }) => {
      await page.goto(path);
      await page.getByRole('heading', { level: 1 }).first().waitFor({ state: 'attached' });
      await expectNoViolations(page, path);
    });
  }
});
