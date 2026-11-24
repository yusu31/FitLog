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

  async snap(label: string, lower: boolean | null) {
    const k = this.steps.length + 1;
    const url = new URL(this.page.url()).pathname;
    this.urls.add(url);
    const scrollY = await this.page.evaluate(() => Math.round(window.scrollY));
    await this.page.screenshot({ path: join(OUT, this.id, `step-${k}.png`) });
    writeFileSync(join(OUT, this.id, `step-${k}.txt`), await this.page.evaluate(() => document.body.innerText), 'utf-8');
    writeFileSync(join(OUT, this.id, `step-${k}.aria.txt`), await this.page.locator('body').ariaSnapshot(), 'utf-8');
    this.steps.push({ k, label, url, scrollY, inLowerHalf: lower });
  }

  // 画面が落ち着くまで待つ: 通信が止み、本文に文字が出て、読み込み中の印（aria-busy="true"）が消える。
  // strict（E1）は見出し（h1）が出るまで必ず待つ。それ以外は待ちきれなくても撮影は続ける（オフラインの画面など）
  async settle(strict: boolean) {
    await this.page.waitForLoadState('networkidle').catch(() => undefined);
    // 地図（MapLibre）が画面にあるときは、タイルとルートが描かれるまで待つ。通信が止んだ直後は灰色のまま写る（V0: A07-4）
    if (await this.page.locator('.maplibregl-canvas').count()) await this.page.waitForTimeout(6000);
    const ready = this.page.waitForFunction(
      // textContent は <script> の中身まで数えるので、画面に見える文字（innerText）で見る
      () => ((document.querySelector('main') as HTMLElement | null)?.innerText ?? '').trim().length > 20 && !document.querySelector('[aria-busy="true"]'),
      undefined,
      { timeout: 30_000 },
    );
    if (strict) {
      await ready;
      await this.page.locator('h1').first().waitFor({ timeout: 30_000 });
    } else {
      await ready.catch(() => undefined);
    }
  }

  // 最初の画面（操作ではない）
  async start(label = '最初の画面') {
    await this.settle(false);
    await this.snap(label, null);
  }

  // 押す・選ぶ（1操作）。押した要素が画面の下半分にあるかも記録（親指の届きやすさ）
  // 押した後、画面が落ち着いてから撮る（利用者が実際に見る画面にするため）。
  // 開発サーバーは初めて開く画面をその場で組み立てる（Rendering…）ので、400ms だけ待つと空白や読み込み中の枠が写った（2026-11-19 の P2 で判明）。
  // 通信が落ち着き、本文に文字が出るまで待つ。操作数の数え方は変わらない
  async click(target: Locator, label: string, opts: { settle?: boolean } = {}) {
    const box = await target.boundingBox();
    const vh = this.page.viewportSize()?.height ?? 844;
    const lower = box ? box.y + box.height / 2 > vh / 2 : null;
    await target.click();
    this.ops++;
    await this.page.waitForTimeout(400);
    await this.settle(opts.settle ?? false);
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
  await page.getByRole('checkbox', { name: /同意/ }).check();
  await t.click(page.getByRole('button', { name: '登録する' }), '登録する');
  await t.click(page.getByRole('link', { name: '種目を選ぶ' }), '種目を選ぶ');
  // P6: 種目選びは「はじめての人向け」が先頭に出る。ベンチプレスは部位の見出しを開かないと出ないので、最初に見える腕立て伏せを選ぶ
  await t.click(page.getByRole('link', { name: /腕立て伏せ/ }).first(), '種目（腕立て伏せ）');
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
  await t.click(page.getByRole('button', { name: /を始める$/ }).first(), 'いつものメニューを始める');
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
  // 仲間（ユウスケ）の足跡にだけ反応する（先頭は自分の足跡なので使わない）
  const card = page.locator('li').filter({ hasText: 'ユウスケ' }).first();
  await t.click(card.getByRole('button', { name: /ナイス/ }), 'スタンプ（ナイス）');
  await t.click(card.getByRole('button', { name: /^コメント/ }), 'コメントを開く');
  await t.click(card.getByRole('button', { name: 'いい調子！' }), '定型コメントを送る');
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
  await t.fill(page.getByLabel('グループ名'), 'ほぐし会2', 'グループ名');
  await t.click(page.getByRole('button', { name: '作る' }), '作る');
  await t.click(page.getByRole('button', { name: '招待リンクを作る' }), '招待リンクを作る');
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
  // 2026-11-24（P5）: 画面の移動を待たずに撮っていた（step-3 が /me のまま）ので、移動と描画を待つ。手数は同じ
  await t.click(page.getByRole('link', { name: /記録のまとめ/ }).first(), '記録のまとめ', { settle: true });
  await page.waitForURL(/\/me\/stats/);
  await t.click(page.getByRole('group', { name: '期間' }).getByRole('button', { name: '月' }), '月に切替');
  t.finish();
});

test('T8 6日ぶりに開いて、また始める', async ({ page }) => {
  const s = seed();
  await page.goto('/login/');
  await loginAs(page, 'back6', s);
  await page.goto('/today/');
  const t = new Tracker(page, 'T8');
  await t.start();
  await t.click(page.getByRole('link', { name: /はじめる|始める|種目を選ぶ/ }).first(), 'はじめる');
  await t.click(page.getByRole('button', { name: 'できた' }), 'できた');
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
  // 2026-11-24（P5）: 表示名は設定の上（その場で直す）だけになった（#397）。アカウントの設定は開かない
  await t.fill(page.getByLabel('表示名'), 'ヨシコさん', '表示名');
  await t.click(page.getByRole('button', { name: '名前を保存' }), '名前を保存', { settle: true });
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
  await t.click(page.getByRole('link', { name: /ベンチプレス/ }).first(), 'メニューの種目');
  await t.click(page.getByRole('button', { name: 'できた' }), 'できた');
  t.finish();
});

// T3: GPS で走って保存し、日本縦断を見る。位置情報は偽物（window.__emit）。実際の GPS 精度は実機でしか確かめられない（本人の操作が必要）
test('T3 GPS で走って保存し、日本縦断がどこまで進んだか見る', async ({ page }) => {
  const s = seed();
  await page.clock.install({ time: new Date(AUDIT_NOW) });
  await page.addInitScript(() => {
    type Cb = (p: unknown) => void;
    let cb: Cb | null = null;
    const w = window as unknown as { __emit: (northM: number) => void };
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { watchPosition: (f: Cb) => ((cb = f), 1), clearWatch: () => (cb = null) },
    });
    w.__emit = (northM: number) =>
      cb?.({ coords: { latitude: 35.68 + northM / ((Math.PI / 180) * 6_371_008.8), longitude: 139.75, accuracy: 5 }, timestamp: Date.now() });
  });
  await page.goto('/login/');
  await loginAs(page, 'active', s);
  await page.goto('/today/');
  const t = new Tracker(page, 'T3');
  await t.start();
  await t.click(page.getByRole('link', { name: /ランを記録/ }), 'ランを記録');
  await t.click(page.getByRole('button', { name: 'GPS で記録する' }), 'GPS で記録する');
  for (let i = 0; i <= 8; i++) {
    await page.evaluate((m) => (window as unknown as { __emit: (n: number) => void }).__emit(m), i * 30);
    await page.clock.runFor(10_000);
  }
  // 偽の時計を止めたままだと地図の描画（タイマー）が進まず、真っ白に写る（V0: A07-4）。走り終えたら実時間に戻す
  await page.clock.resume();
  await t.click(page.getByRole('button', { name: '終了' }), '終了');
  // 終了を押すと、そのまま保存されて「記録したよ」の画面に変わる（B07）。以前の「保存する」ボタンは無い
  await t.click(page.getByRole('link', { name: /日本地図で見る/ }), '日本地図で見る');
  t.finish();
});

// T5: 2秒動画。ローカルに S3 が無いので、撮影の入口（ボタンまで）と、仲間の足跡から詳細へ行く道までを数える。撮影・保存・再生は未確認（原理的に不可能: S3 なし。実機・本番で本人が確認）
test('T5 2秒動画を撮って、仲間の動画を見る（入口まで）', async ({ page }) => {
  const s = seed();
  await page.goto('/login/');
  await loginAs(page, 'active', s);
  await page.goto('/today/');
  const t = new Tracker(page, 'T5');
  await t.start();
  await t.click(page.getByRole('button', { name: /を始める$/ }).first(), 'いつものメニューを始める');
  await t.click(page.getByRole('button', { name: 'できた' }), 'できた');
  // P6（D3-7）: 2秒動画の入口は「ほかの操作」のシートの中
  await t.click(page.getByRole('button', { name: 'ほかの操作' }), 'ほかの操作');
  await t.click(page.getByRole('button', { name: /2秒動画を撮る/ }), '2秒動画を撮る');
  t.finish();
});

test('T5b 仲間の足跡のくわしく見る（動画再生の入口）', async ({ page }) => {
  const s = seed();
  await page.goto('/login/');
  await loginAs(page, 'active', s);
  await page.goto('/today/');
  const t = new Tracker(page, 'T5b');
  await t.start();
  await t.click(tab(page, '仲間'), 'タブ「仲間」');
  await t.click(page.locator('li').filter({ hasText: 'ユウスケ' }).first().getByRole('link', { name: 'くわしく見る' }), 'くわしく見る');
  t.finish();
});

// E1: アプリの中を見て回る（P2 の盲検評価用。タスクではないので合否の線は当てはめない）。
// ツリー・ファーストクリックでは「押した後の挙動」が見えないため、自分の足跡と仲間の足跡の詳細、自分タブからの記録の詳細を、操作の結果の画面ごと残す
test('E1 アプリの中を見て回る（自分と仲間の足跡の詳細を開く）', async ({ page }) => {
  const s = seed();
  await page.goto('/login/');
  await loginAs(page, 'active', s);
  await page.goto('/today/');
  const t = new Tracker(page, 'E1');
  await t.start();
  const settle = { settle: true };
  await t.click(tab(page, '仲間'), 'タブ「仲間」', settle);
  const self = page.locator('li').filter({ hasText: s.users.active.name }).filter({ has: page.getByRole('link', { name: 'くわしく見る' }) }).first();
  await t.click(self.getByRole('link', { name: 'くわしく見る' }), '自分の足跡の「くわしく見る」', settle);
  // 自分の足跡は自分用の詳細（from=me）で開くので、戻る先は「自分」タブ（#329）。仲間の足跡へ行くには仲間タブへ入り直す
  await t.click(page.getByRole('link', { name: /(にもどる|へ戻る)$/ }).first(), '画面上の「にもどる」（自分タブへ）', settle);
  await t.click(tab(page, '仲間'), 'タブ「仲間」', settle);
  await t.click(page.locator('li').filter({ hasText: 'ユウスケ' }).first().getByRole('link', { name: 'くわしく見る' }), '仲間（ユウスケ）の足跡の「くわしく見る」', settle);
  // 詳細画面には下タブが無いので、いったん戻ってから「自分」へ
  await t.click(page.getByRole('link', { name: /(にもどる|へ戻る)$/ }).first(), '画面上の「仲間にもどる」', settle);
  await t.click(tab(page, '自分'), 'タブ「自分」', settle);
  await t.click(page.getByRole('link', { name: /ベンチプレス ほか1種目/ }).first(), '自分の記録（11/17）を開く', settle);
  t.finish();
});

// T11: 電波が無い所で記録し、戻ったら送られる
test('T11 電波の無いジムで1セット記録し、電波が戻ったら送られたことを確かめる', async ({ page, context }) => {
  const s = seed();
  await page.goto('/login/');
  await loginAs(page, 'active', s);
  await page.goto('/today/');
  await page.waitForLoadState('networkidle');
  const t = new Tracker(page, 'T11');
  await t.start();
  await t.click(page.getByRole('button', { name: /を始める$/ }).first(), 'いつものメニューを始める');
  await context.setOffline(true);
  await t.click(page.getByRole('button', { name: 'できた' }), 'できた（オフライン）');
  await page.waitForTimeout(800);
  await context.setOffline(false);
  await page.waitForTimeout(3000);
  await t.snap('電波が戻った後', null);
  t.finish();
});

// T12: 200% 拡大（195×422 相当）・横向き・320 幅で、同じ道（T2）を通す。読み上げの名前は step-k.aria.txt（アクセシビリティツリー）
for (const [name, w, h] of [['200%', 195, 422], ['横向き', 844, 390], ['320幅', 320, 568]] as const) {
  test(`T12 ${name} で前回と同じメニューを始める`, async ({ page }) => {
    const s = seed();
    await page.setViewportSize({ width: w, height: h });
    await page.goto('/login/');
    await loginAs(page, 'active', s);
    await page.goto('/today/');
    const t = new Tracker(page, `T12-${w}x${h}`);
    await t.start();
    const over = async () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    console.log(`T12 ${name} 最初の画面の横はみ出し=${await over()}px`);
    await t.click(page.getByRole('button', { name: /を始める$/ }).first(), 'いつものメニューを始める');
    await t.click(page.getByRole('button', { name: 'できた' }), 'できた');
    console.log(`T12 ${name} 記録中の横はみ出し=${await over()}px`);
    t.finish();
  });
}
