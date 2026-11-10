// 電波のない場所でも開けるよう、Service Worker が端末に先に保存する画面（静的書き出しの HTML）の一覧。
// 画面（app/ の page.tsx）を足したら、ここにも足す。漏れは precache-pages.test.ts が見張る。
// 詳細ページは ?id= で表すので、/record-detail/ の1つの HTML をどの id でも使い回す（sw.ts の ignoreURLParametersMatching）
export const PRECACHE_PAGES: readonly string[] = [
  '/',
  '/exercises/',
  '/friends/',
  '/invite/',
  '/login/',
  '/me/',
  '/record-detail/',
  '/record/',
  '/rest/',
  '/run/',
  '/settings/',
  '/settings/group/',
  '/settings/credits/',
  '/signup/',
  '/today/',
];
