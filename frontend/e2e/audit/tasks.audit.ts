import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { test, type Locator, type Page } from '@playwright/test';
import { AUDIT_NOW, PASSWORD, type SeedResult } from './seed';

// 共通タスク T1〜T13（実施要領 6章）を実機でたどり、操作数・画面数・縦スクロールを数える。
// 「操作」＝入力欄への入力・ボタンやリンクを押す・選ぶ、を1つずつ。ページを開く（goto）は数えない（最初の画面として与えられるため）。
// 各ステップで撮影（step-k.png）と画面の文字（step-k.txt）を残す。これが P2 のストーリーボードになる。
const OUT = join(__dirname, 'out');
const seed = (): SeedResult => JSON.parse(readFileSync(join(__dirname, '.seed.json'), 'utf-8'));

type StepLog = { k: number; label: string; url: string; scrollY: number; inLowerHalf: boolean | null };
type TaskLog = { task: string; ops: number; screens: number; steps: StepLog[] };

class Tracker {
  ops = 0;
  steps: StepLog[] = [];
  urls = new Set<string>();
  constructor(readonly page: Page, readonly id: string) {
    mkdirSync(join(OUT, id), { recursive: true });
  }

  private async snap(label: string, lower: boolean | null) {
    const k = this.steps.length + 1;
    const url = new URL(this.page.url()).pathname;
    this.urls.add(url);
    const scrollY = await this.page.evaluate(() => Math.round(window.scrollY));
    await this.page.screenshot({ path: join(OUT, this.id, `step-${k}.png`) });
    writeFileSync(join(OUT, this.id, `step-${k}.txt`), await this.page.evaluate(() => document.body.innerText), 'utf-8');
    this.steps.push({ k, label, url, scrollY, inLowerHalf: lower });
  }

  // 最初の画面（操作ではない）
  async start(label = '最初の画面') {
    await this.page.waitForLoadState('networkidle');
    await this.snap(label, null);
  }

  // 押す・選ぶ（1操作）。押した要素が画面の下半分にあるかも記録（親指の届きやすさ）
  async click(target: Locator, label: string) {
    const box = await target.boundingBox();
    const vh = this.page.viewportSize()?.height ?? 844;
    const lower = box ? box.y + box.height / 2 > vh / 2 : null;
    await target.click();
    this.ops++;
    await this.page.waitForTimeout(400);
    await this.snap(label, lower);
  }

  // 入力（1操作）
  async fill(target: Locator, value: string, label: string) {
    await target.fill(value);
    this.ops++;
    await this.snap(label, null);
  }

  finish(): TaskLog {
    const log: TaskLog = { task: this.id, ops: this.ops, screens: this.urls.size, steps: this.steps };
    writeFileSync(join(OUT, this.id, 'log.json'), JSON.stringify(log, null, 2), 'utf-8');
    console.log(`${this.id}: 操作=${log.ops} 画面=${log.screens}`);
    return log;
  }
}

// 状態ユーザーでログインした状態にする（ログイン操作はタスクに数えない。T1・T10 は登録からたどる）
async function loginAs(page: Page, state: keyof SeedResult['users'], s: SeedResult) {
  const base = new URL(page.url() === 'about:blank' ? (test.info().project.use.baseURL as string) : page.url()).origin;
  const res = await page.request.post('/api/auth/sign-in/email', {
    data: { email: s.users[state].email, password: PASSWORD },
    headers: { Origin: base },
  });
  if (!res.ok()) throw new Error(`login 失敗 ${state}: ${res.status()}`);
}

test.use({ viewport: { width: 390, height: 844 } });
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(AUDIT_NOW);
});

const tab = (page: Page, name: string) => page.getByRole('link', { name }).last();

test('T1 初めて開いて登録し、今日の筋トレを1セット記録する', async ({ page }) => {
  const t = new Tracker(page, 'T1');
  await page.goto('/signup/');
  await t.start();
  await t.fill(page.getByLabel('表示名'), '新入りの人', '表示名');
  await t.fill(page.getByLabel('メールアドレス'), `audit-t1-${randomUUID().slice(0, 6)}@example.com`, 'メール');
  await t.fill(page.getByLabel(/^パスワード/), PASSWORD, 'パスワード');
  await t.click(page.getByRole('button', { name: '登録する' }), '登録する');
  await t.click(page.getByRole('link', { name: '種目を選ぶ' }), '種目を選ぶ');
  await t.click(page.getByRole('link', { name: /ベンチプレス/ }).first(), '種目（ベンチプレス）');
  await t.click(page.getByRole('button', { name: 'できた' }), 'できた');
  t.finish();
});

test('T2 前回と同じメニューで今日の筋トレを始める', async ({ page }) => {
  const s = seed();
  await page.goto('/login/');
  await loginAs(page, 'active', s);
  await page.goto('/today/');
  const t = new Tracker(page, 'T2');
  await t.start();
  await t.click(page.getByRole('button', { name: /を始める$/ }).first(), 'ルーティンを始める');
  await t.click(page.getByRole('button', { name: 'できた' }), 'できた');
  t.finish();
});

test('T4 仲間の今日の運動を見て、スタンプとコメントを送る', async ({ page }) => {
  const s = seed();
  await page.goto('/login/');
  await loginAs(page, 'active', s);
  await page.goto('/today/');
  const t = new Tracker(page, 'T4');
  await t.start();
  await t.click(tab(page, '仲間'), 'タブ「仲間」');
  await t.click(page.getByRole('button', { name: /スタンプ|ナイス|すごい|おつかれ|いいね/ }).first(), 'スタンプ');
  t.finish();
});

test('T6 グループを作って招待リンクを送る', async ({ page }) => {
  const s = seed();
  await page.goto('/login/');
  await loginAs(page, 'solo', s);
  await page.goto('/today/');
  const t = new Tracker(page, 'T6');
  await t.start();
  await t.click(tab(page, '仲間'), 'タブ「仲間」');
  await t.click(page.getByRole('button', { name: /グループを作る/ }).or(page.getByRole('link', { name: /グループを作る/ })).first(), 'グループを作る');
  t.finish();
});

test('T7 今週・今月どれだけ動いたかを振り返る', async ({ page }) => {
  const s = seed();
  await page.goto('/login/');
  await loginAs(page, 'active', s);
  await page.goto('/today/');
  const t = new Tracker(page, 'T7');
  await t.start();
  await t.click(tab(page, '自分'), 'タブ「自分」');
  await t.click(page.getByRole('link', { name: /記録をくわしく/ }).first(), '記録をくわしく');
  t.finish();
});

test('T8 6日ぶりに開いて、また始める', async ({ page }) => {
  const s = seed();
  await page.goto('/login/');
  await loginAs(page, 'back6', s);
  await page.goto('/today/');
  const t = new Tracker(page, 'T8');
  await t.start();
  await t.click(page.getByRole('link', { name: /はじめる|種目を選ぶ/ }).first(), 'はじめる');
  t.finish();
});

test('T9 表示名を変える。ログアウトと退会の場所を確かめる', async ({ page }) => {
  const s = seed();
  await page.goto('/login/');
  await loginAs(page, 'solo', s);
  await page.goto('/me/');
  const t = new Tracker(page, 'T9');
  await t.start();
  await t.click(page.getByRole('link', { name: '設定' }).first(), '設定');
  await t.click(page.getByRole('link', { name: /アカウントの設定/ }), 'アカウントの設定');
  t.finish();
});

test('T10 公開URLを初めて開き、登録まで進む', async ({ page }) => {
  await page.goto('/login/');
  const t = new Tracker(page, 'T10');
  await t.start();
  await t.click(page.getByRole('link', { name: '新規登録' }), '新規登録');
  t.finish();
});

test('T13 きのう記録し忘れた筋トレをあとから記録する', async ({ page }) => {
  const s = seed();
  await page.goto('/login/');
  await loginAs(page, 'back6', s);
  await page.goto('/today/');
  const t = new Tracker(page, 'T13');
  await t.start();
  await t.click(page.getByRole('button', { name: /きのう/ }).first(), 'きのう');
  t.finish();
});
