import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, type Page } from '@playwright/test';
import { AUDIT_NOW, PASSWORD, type SeedResult } from './seed';

// 1b UI 一貫性の機械検査（実施要領 7章 P1-1b）。全画面×画面条件×状態を撮り、見えている要素の computed style と位置・大きさを JSON に残す。
// 判定は analyze-ui.py が行う（基準は実施前に固定済み: 要領 7章 P1-1b「判定」）。P5 で同じスクリプトをそのまま再実行して前後を比べる。
const OUT = join(__dirname, 'out', 'ui');
const seed = (): SeedResult => JSON.parse(readFileSync(join(__dirname, '.seed.json'), 'utf-8'));

const VIEWPORTS = [
  { id: '390x844', width: 390, height: 844, dsf: 1 },
  { id: '360x780', width: 360, height: 780, dsf: 1 },
  { id: '844x390', width: 844, height: 390, dsf: 1 },
  { id: '195x422-x2', width: 195, height: 422, dsf: 2 }, // 390 幅の 200% 拡大に相当（WCAG 1.4.4）
  { id: '320x568', width: 320, height: 568, dsf: 1 }, // 1.4.10 リフロー
] as const;

type Shot = { name: string; path: string; prepare?: (page: Page) => Promise<void> };

const SCREENS: Shot[] = [
  { name: 'today', path: '/today/' },
  { name: 'exercises', path: '/exercises/' },
  { name: 'run', path: '/run/' },
  { name: 'rest', path: '/rest/' },
  { name: 'friends', path: '/friends/' },
  { name: 'me', path: '/me/' },
  { name: 'me-stats', path: '/me/stats/' },
  { name: 'settings', path: '/settings/' },
  { name: 'settings-account', path: '/settings/account/' },
  { name: 'settings-group', path: '/settings/group/' },
  { name: 'settings-credits', path: '/settings/credits/' },
  {
    // 記録中の画面（ルーティンから始める）
    name: 'record',
    path: '/today/',
    prepare: async (page) => {
      await page.getByRole('button', { name: /を始める$/ }).first().click();
      await page.waitForURL(/\/record/);
    },
  },
  {
    // 記録の詳細（仲間の足跡から）
    name: 'record-detail',
    path: '/friends/',
    prepare: async (page) => {
      await page.locator('li').filter({ hasText: 'ユウスケ' }).first().getByRole('link', { name: 'くわしく見る' }).click();
      await page.waitForURL(/\/record-detail/);
    },
  },
  {
    // 結果シート（「できた」の直後）
    name: 'record-result-sheet',
    path: '/today/',
    prepare: async (page) => {
      await page.getByRole('button', { name: /を始める$/ }).first().click();
      await page.waitForURL(/\/record/);
      await page.getByRole('button', { name: 'できた' }).click();
      await page.waitForTimeout(600);
    },
  },
];
const PUBLIC: Shot[] = [
  { name: 'login', path: '/login/' },
  { name: 'signup', path: '/signup/' },
  { name: 'invite-invalid', path: '/invite/?token=invalid' },
];

// 見えている要素の style・位置・大きさを集める（ブラウザ内で実行）
async function collect(page: Page) {
  return page.evaluate(() => {
    const out: Record<string, unknown>[] = [];
    const interactive = 'a,button,input,select,textarea,[role="button"],[role="tab"],[role="link"]';
    const vw = document.documentElement.clientWidth;
    for (const el of Array.from(document.body.querySelectorAll('*'))) {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      if (cs.display === 'none' || cs.visibility === 'hidden' || r.width === 0 || r.height === 0) continue;
      const own = Array.from(el.childNodes).filter((n) => n.nodeType === 3 && (n.textContent ?? '').trim()).map((n) => (n.textContent ?? '').trim()).join('');
      const isInteractive = el.matches(interactive);
      if (!own && !isInteractive && !el.matches('h1,h2,h3,header,nav,main,footer')) continue;
      out.push({
        tag: el.tagName.toLowerCase(),
        text: (own || el.getAttribute('aria-label') || '').slice(0, 24),
        interactive: isInteractive,
        fontSize: cs.fontSize,
        fontWeight: cs.fontWeight,
        lineHeight: cs.lineHeight,
        fontFamily: cs.fontFamily.split(',')[0].trim(),
        color: cs.color,
        background: cs.backgroundColor,
        radius: cs.borderRadius,
        shadow: cs.boxShadow === 'none' ? '' : cs.boxShadow,
        rect: [Math.round(r.x * 10) / 10, Math.round(r.y * 10) / 10, Math.round(r.width * 10) / 10, Math.round(r.height * 10) / 10],
      });
    }
    // 固定の部品の位置（画面間で比べる）
    const pick = (sel: string) => {
      const e = document.querySelector(sel);
      if (!e) return null;
      const r = e.getBoundingClientRect();
      return [Math.round(r.x * 10) / 10, Math.round(r.y * 10) / 10, Math.round(r.width * 10) / 10, Math.round(r.height * 10) / 10];
    };
    return {
      elements: out,
      overflowX: document.documentElement.scrollWidth - vw,
      scrollHeight: document.documentElement.scrollHeight,
      anchors: { h1: pick('h1'), header: pick('header'), main: pick('main'), nav: pick('nav'), tabbar: pick('nav[aria-label], [role="navigation"]') },
    };
  });
}

for (const state of ['active', 'new'] as const) {
  for (const vp of VIEWPORTS) {
    test(`UI ${state} ${vp.id}`, async ({ browser }) => {
      const s = seed();
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.dsf, reducedMotion: 'reduce' });
      const page = await ctx.newPage();
      await page.clock.setFixedTime(AUDIT_NOW);
      const dir = join(OUT, state, vp.id);
      mkdirSync(dir, { recursive: true });

      const shoot = async (shot: Shot) => {
        try {
          await page.goto(shot.path);
          await page.waitForLoadState('networkidle');
          if (shot.prepare) await shot.prepare(page);
          await page.waitForLoadState('networkidle');
          await page.waitForTimeout(300);
          const data = await collect(page);
          writeFileSync(join(dir, `${shot.name}.json`), JSON.stringify({ ...data, url: new URL(page.url()).pathname + new URL(page.url()).search }, null, 1), 'utf-8');
          // 地図（canvas）と動画は揺れるので隠して撮る。隠す色は既定のマゼンタだと「壊れた地図」に見えるので、灰色にする（V0: A07-8 の原因）
          await page.screenshot({ path: join(dir, `${shot.name}.png`), fullPage: true, mask: [page.locator('canvas'), page.locator('video')], maskColor: '#e5e7eb' });
        } catch (e) {
          writeFileSync(join(dir, `${shot.name}.error.txt`), String(e).slice(0, 600), 'utf-8');
        }
      };

      // 未ログインで撮る画面
      for (const shot of PUBLIC) await shoot(shot);
      // ログインして撮る
      const res = await page.request.post('/api/auth/sign-in/email', {
        data: { email: s.users[state].email, password: PASSWORD },
        headers: { Origin: new URL(page.url() === 'about:blank' ? (test.info().project.use.baseURL as string) : page.url()).origin },
      });
      if (!res.ok()) throw new Error(`login 失敗: ${res.status()}`);
      for (const shot of SCREENS) {
        // 記録・詳細・結果シートは new 状態では道が無い（ルーティン・仲間なし）ので対象外（待ち続けて時間切れになるため）
        if (state === 'new' && ['record', 'record-detail', 'record-result-sheet'].includes(shot.name)) continue;
        await shoot(shot);
      }
      await ctx.close();
    });
  }
}
