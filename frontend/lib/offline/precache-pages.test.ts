import { readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { PRECACHE_PAGES } from './precache-pages';

// app/ の下の page.tsx を全部探し、静的書き出しで出る URL（末尾スラッシュつき）にする
function findPageUrls(dir: string, root: string): string[] {
  const urls: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      urls.push(...findPageUrls(path, root));
    } else if (name === 'page.tsx') {
      const rel = relative(root, dir).split(sep).join('/');
      urls.push(rel === '' ? '/' : `/${rel}/`);
    }
  }
  return urls;
}

describe('PRECACHE_PAGES（電波なしで開ける画面の一覧）', () => {
  const pageUrls = findPageUrls(join(process.cwd(), 'app'), join(process.cwd(), 'app')).sort();

  it('app/ にある画面（page.tsx）を1つ残らず含む（足し忘れると、その画面だけ電波なしで開けない）', () => {
    expect(pageUrls.length).toBeGreaterThan(0);
    expect([...PRECACHE_PAGES].sort()).toEqual(pageUrls);
  });

  it('同じ URL を2回書かない', () => {
    expect(new Set(PRECACHE_PAGES).size).toBe(PRECACHE_PAGES.length);
  });
});
