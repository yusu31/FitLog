import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, type Page } from '@playwright/test';
import { AUDIT_NOW, PASSWORD, type SeedResult } from './seed';

// V0 確かめ（P4 束 V0）。要確認の項目が本物か環境由来かを、撮り直しと再現で判定する。
// 待ちは「通信が落ち着き、本文に文字が出て、aria-busy が無い」まで。地図は load と描画の落ち着きまで。
const OUT = process.env.V0_OUT ?? join(__dirname, "out", "v0");
const seed = (): SeedResult => JSON.parse(readFileSync(join(__dirname, '.seed.json'), 'utf-8'));
mkdirSync(OUT, { recursive: true });

test.use({ viewport: { width: 390, height: 844 } });
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(AUDIT_NOW);
});

async function loginAs(page: Page, state: string) {
  const s = seed();
  const base = test.info().project.use.baseURL as string;
  await page.goto('/login/');
  const res = await page.request.post('/api/auth/sign-in/email', { data: { email: s.users[state].email, password: PASSWORD }, headers: { Origin: base } });
  if (!res.ok()) throw new Error(`login 失敗 ${state}: ${res.status()}`);
}

async function settle(page: Page) {
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await page
    .waitForFunction(() => ((document.querySelector('main') as HTMLElement | null)?.innerText ?? '').trim().length > 20 && !document.querySelector('[aria-busy="true"]'), undefined, { timeout: 30_000 })
    .catch(() => undefined);
}

async function shot(page: Page, name: string, fullPage = true) {
  await page.screenshot({ path: join(OUT, `${name}.png`), fullPage });
}
function note(name: string, text: string) {
  writeFileSync(join(OUT, `${name}.txt`), text, 'utf-8');
  console.log(`[${name}] ${text.slice(0, 600).replace(/\n/g, ' / ')}`);
}

// 地図が描き終わるのを待つ（canvas が出て、load 後に通信が止まって、少し置く）
async function waitMap(page: Page) {
  await page.locator('.maplibregl-canvas').first().waitFor({ timeout: 30_000 }).catch(() => undefined);
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await page.waitForTimeout(6000);
}

async function webgl(page: Page) {
  return page.evaluate(() => {
    const c = document.createElement('canvas');
    const gl = (c.getContext('webgl2') || c.getContext('webgl')) as WebGLRenderingContext | null;
    if (!gl) return 'WebGL 使えない';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return `WebGL 使える: ${ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'renderer 不明'}`;
  });
}

test('A07-8 日本縦断の地図（待ちを延ばして撮る）', async ({ page }) => {
  const reqs: string[] = [];
  const logs: string[] = [];
  page.on('requestfailed', (r) => reqs.push(`FAILED ${r.url()} ${r.failure()?.errorText}`));
  page.on('response', (r) => {
    if (/openfreemap|tiles|pmtiles/.test(r.url())) reqs.push(`${r.status()} ${r.url()}`);
  });
  page.on('console', (m) => logs.push(`${m.type()}: ${m.text()}`.slice(0, 200)));
  await loginAs(page, 'active');
  await page.goto('/me/stats/');
  await settle(page);
  await waitMap(page);
  const gl = await webgl(page);
  // 撮り方 A: 隠さずに撮る（本物の見え方）
  await shot(page, 'A07-8_japan-map_unmasked');
  // 撮り方 B: 既存の ui.audit と同じ canvas を隠す撮り方（マスクの色が出る）
  await page.screenshot({ path: join(OUT, 'A07-8_japan-map_masked-as-ui-audit.png'), fullPage: true, mask: [page.locator('canvas'), page.locator('video')] });
  const info = await page.evaluate(() => {
    const cv = document.querySelector('.maplibregl-canvas') as HTMLCanvasElement | null;
    return cv ? `canvas ${cv.width}x${cv.height}` : 'canvas なし';
  });
  const failedText = await page.getByText('地図は この端末では出せませんでした').count();
  note('A07-8', `${gl}\n${info}\n代替表示の文言の数=${failedText}\nconsole:\n${logs.slice(0, 15).join('\n')}\nrequests:\n${reqs.slice(0, 20).join('\n')}`);
});

test('A07-4 保存前の地図（GPS で走って終了した後）', async ({ page }) => {
  const s = seed();
  void s;
  await page.clock.install({ time: new Date(AUDIT_NOW) });
  await page.addInitScript(() => {
    type Cb = (p: unknown) => void;
    let cb: Cb | null = null;
    const w = window as unknown as { __emit: (northM: number) => void };
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { watchPosition: (f: Cb) => ((cb = f), 1), clearWatch: () => (cb = null) } });
    w.__emit = (northM: number) => cb?.({ coords: { latitude: northM / ((Math.PI / 180) * 6_371_008.8), longitude: 139.7, accuracy: 5 }, timestamp: Date.now() });
  });
  await loginAs(page, 'active');
  await page.goto('/today/');
  await settle(page);
  await page.getByRole('link', { name: /ランを記録/ }).click();
  await settle(page);
  await page.getByRole('button', { name: 'GPS で記録する' }).click();
  for (let i = 0; i <= 8; i++) {
    await page.evaluate((m) => (window as unknown as { __emit: (n: number) => void }).__emit(m), i * 30);
    await page.clock.runFor(10_000);
  }
  await page.getByRole('button', { name: '終了' }).click();
  await settle(page);
  // 時計を止めたままだと地図の描画が進まないので、実時間に戻す
  await page.clock.resume();
  await waitMap(page);
  await shot(page, 'A07-4_run-before-save-map');
  const gl = await webgl(page);
  note('A07-4', `${gl}\ncanvas数=${await page.locator('.maplibregl-canvas').count()}`);
});

test('A04-7 コメントの時刻と運動の時刻', async ({ page }) => {
  await loginAs(page, 'active');
  const out: string[] = [];
  // 仲間（タカシ）の足跡：ユウスケのコメントがついている
  await page.goto('/friends/');
  await settle(page);
  for (const who of ['タカシ', 'ユウスケ']) {
    await page.goto('/friends/');
    await settle(page);
    const card = page.locator('li').filter({ hasText: who }).filter({ has: page.getByRole('link', { name: 'くわしく見る' }) }).first();
    await card.getByRole('link', { name: 'くわしく見る' }).click();
    await page.waitForURL(/record-detail/);
    await settle(page);
    await page.waitForTimeout(800);
    await shot(page, `A04-7_detail-${who}`);
    out.push(`--- ${who}\n${await page.evaluate(() => (document.querySelector('main') as HTMLElement).innerText)}`);
  }
  // 自分の最新（コメントあり）
  await page.goto('/me/');
  await settle(page);
  await page.getByRole('link', { name: /ベンチプレス ほか1種目/ }).first().click();
  await page.waitForURL(/record-detail/);
  await settle(page);
  await page.waitForTimeout(800);
  await shot(page, 'A04-7_detail-self');
  out.push(`--- self\n${await page.evaluate(() => (document.querySelector('main') as HTMLElement).innerText)}`);
  // API の生の時刻（記録の時刻とコメントの時刻）
  const j = await page.evaluate(async () => {
    const r = await fetch('/api/records?limit=50', { credentials: 'include' });
    return r.ok ? r.text() : `status ${r.status}`;
  });
  out.push(`--- API /records\n${j.slice(0, 400)}`);
  note('A04-7', out.join('\n'));
});

test('A09-5 グループを作った直後の足跡（solo が作る）', async ({ page }) => {
  await loginAs(page, 'solo');
  await page.goto('/friends/');
  await settle(page);
  await shot(page, 'A09-5_before-create');
  await page.getByRole('button', { name: /グループを作る/ }).or(page.getByRole('link', { name: /グループを作る/ })).first().click();
  await page.getByLabel('グループ名').fill('V0げんてい');
  await page.getByRole('button', { name: '作る' }).click();
  await settle(page);
  await page.waitForTimeout(1500);
  await settle(page);
  await shot(page, 'A09-5_after-create');
  note('A09-5', await page.evaluate(() => (document.querySelector('main') as HTMLElement).innerText));
});

test('A10-3 名前を変えて保存した後の表示', async ({ page }) => {
  await loginAs(page, 'back6');
  await page.goto('/settings/account/');
  await settle(page);
  await shot(page, 'A10-3_1-before');
  await page.getByLabel('表示名').fill('ケンタさん');
  await page.getByRole('button', { name: '名前を保存する' }).click();
  await page.waitForTimeout(1500);
  await settle(page);
  await shot(page, 'A10-3_2-after-save-same-page');
  const afterSame = await page.evaluate(() => (document.querySelector('main') as HTMLElement).innerText);
  await page.getByRole('link', { name: '設定へ戻る' }).or(page.getByRole('button', { name: '設定へ戻る' })).click();
  await settle(page);
  await page.waitForTimeout(800);
  await shot(page, 'A10-3_3-settings');
  const settings = await page.evaluate(() => (document.querySelector('main') as HTMLElement).innerText);
  await page.goto('/me/');
  await settle(page);
  await shot(page, 'A10-3_4-me');
  const me = await page.evaluate(() => (document.querySelector('main') as HTMLElement).innerText);
  const api = await page.evaluate(async () => (await (await fetch('/api/auth/get-session', { credentials: 'include' })).text()).slice(0, 300));
  note('A10-3', `保存直後のアカウント画面:\n${afterSame.slice(0, 300)}\n---設定画面:\n${settings.slice(0, 300)}\n---自分:\n${me.slice(0, 200)}\n---get-session:\n${api}`);
});

test('A11-4 記録中の画面に壊れた画像が出るか（オンライン・オフライン）', async ({ page, context }) => {
  const bad: string[] = [];
  page.on('requestfailed', (r) => bad.push(`FAILED ${r.url()} ${r.failure()?.errorText}`));
  page.on('response', (r) => {
    if (r.status() >= 400) bad.push(`${r.status()} ${r.url()}`);
  });
  await loginAs(page, 'active');
  await page.goto('/today/');
  await settle(page);
  await page.getByRole('button', { name: /を始める$/ }).first().click();
  await page.waitForURL(/\/record/);
  await settle(page);
  await shot(page, 'A11-4_1-record-online');
  const imgs = async () =>
    page.evaluate(() =>
      Array.from(document.querySelectorAll('img')).map((i) => `${i.src.slice(-60)} complete=${i.complete} natural=${i.naturalWidth}x${i.naturalHeight} alt="${i.alt}" rect=${JSON.stringify(i.getBoundingClientRect().toJSON())}`).join('\n'),
    );
  const online = await imgs();
  await context.setOffline(true);
  await page.getByRole('button', { name: 'できた' }).click();
  await page.waitForTimeout(1500);
  await shot(page, 'A11-4_2-after-dekita-offline');
  const offline = await imgs();
  await context.setOffline(false);
  await page.waitForTimeout(3000);
  await shot(page, 'A11-4_3-back-online');
  const back = await imgs();
  note('A11-4', `online imgs:\n${online}\n---offline imgs:\n${offline}\n---back online:\n${back}\n---bad requests:\n${bad.join('\n')}`);
});

test('A13-6 クレジット画面', async ({ page }) => {
  await loginAs(page, 'active');
  await page.goto('/settings/');
  await settle(page);
  await shot(page, 'A13-6_0-settings');
  await page.goto('/settings/credits/');
  await settle(page);
  await shot(page, 'A13-6_credits');
  note('A13-6', (await page.evaluate(() => (document.querySelector('main') as HTMLElement).innerText)).slice(0, 1200));
});

test('A13-7 エラー表示（ログイン・登録・招待）', async ({ page }) => {
  const out: string[] = [];
  await page.goto('/login/');
  await settle(page);
  await page.getByLabel('メールアドレス').fill('nobody@example.com');
  await page.getByLabel(/^パスワード/).fill('wrong-password-xx');
  await page.getByRole('button', { name: 'ログイン' }).last().click();
  await page.waitForTimeout(2500);
  await shot(page, 'A13-7_login-wrong-password');
  out.push(`login: ${await page.evaluate(() => document.body.innerText)}`);
  await page.goto('/signup/');
  await settle(page);
  await page.getByLabel('表示名').fill('x');
  await page.getByLabel('メールアドレス').fill('not-an-email');
  await page.getByLabel(/^パスワード/).fill('short');
  await page.getByRole('button', { name: '登録する' }).click();
  await page.waitForTimeout(1500);
  await shot(page, 'A13-7_signup-invalid');
  out.push(`signup: ${await page.evaluate(() => document.body.innerText)}`);
  note('A13-7', out.join('\n---\n'));
});

test('A13-8 招待リンクが無効なときの画面', async ({ page }) => {
  await page.goto('/invite/?token=invalid');
  await settle(page);
  await shot(page, 'A13-8_invite-invalid-loggedout');
  const a = await page.evaluate(() => document.body.innerText);
  await loginAs(page, 'solo');
  await page.goto('/invite/?token=invalid');
  await settle(page);
  await shot(page, 'A13-8_invite-invalid-loggedin');
  const b = await page.evaluate(() => document.body.innerText);
  note('A13-8', `未ログイン:\n${a}\n---ログイン済み:\n${b}`);
});

test('A06-3 カメラ許可に失敗したときの画面', async ({ page }) => {
  await loginAs(page, 'active');
  await page.goto('/today/');
  await settle(page);
  await page.getByRole('button', { name: /を始める$/ }).first().click();
  await page.waitForURL(/\/record/);
  await settle(page);
  await page.getByRole('button', { name: 'できた' }).click();
  await settle(page);
  await page.getByRole('button', { name: /2秒ラストレップを撮る/ }).click();
  await page.waitForTimeout(2500);
  await shot(page, 'A06-3_camera-denied');
  note('A06-3', await page.evaluate(() => document.body.innerText));
});

test('A06-4 仲間の足跡カードに動画の印があるか（動画なしの seed・S3 なしのため入口の有無だけ）', async ({ page }) => {
  await loginAs(page, 'active');
  await page.goto('/friends/');
  await settle(page);
  await shot(page, 'A06-4_friends-feed');
  const html = await page.evaluate(() => Array.from(document.querySelectorAll('li')).slice(0, 3).map((l) => l.innerHTML.slice(0, 500)).join('\n---\n'));
  note('A06-4', html);
});

test('A10-3b 保存後に設定画面へ（画面内の移動）で名前が変わるか', async ({ page }) => {
  await loginAs(page, 'solo');
  await page.goto('/settings/');
  await settle(page);
  const before = await page.locator('main p.text-lg').first().innerText().catch(() => 'n/a');
  await page.getByRole('link', { name: /アカウントの設定/ }).click();
  await page.getByLabel('表示名').waitFor();
  await page.getByLabel('表示名').fill('ヨシコさん2');
  await page.getByRole('button', { name: '名前を保存する' }).click();
  await page.getByText('保存しました').waitFor();
  await page.getByRole('link', { name: '設定へ戻る' }).click();
  await page.waitForURL(/\/settings\/?$/);
  await settle(page);
  await page.waitForTimeout(1000);
  await shot(page, 'A10-3b_settings-after-save');
  const after = await page.locator('main p.text-lg').first().innerText().catch(() => 'n/a');
  note('A10-3b', `保存前の設定画面の名前=${before}\n保存後の設定画面の名前=${after}`);
});
