import { DEFAULT_NEXT_PATH, safeNextPath, withNext } from './next-path';

describe('safeNextPath（ログイン後の戻り先）', () => {
  // T-AUTH-FE-01: 空・未指定は既定の画面（同値分割: 値なし）
  it.each([null, undefined, ''])('%s のときは既定の画面へ', (raw) => {
    expect(safeNextPath(raw)).toBe(DEFAULT_NEXT_PATH);
  });

  // T-AUTH-FE-02: このサイトの中のパスはそのまま通す。招待リンクのクエリも保つ
  it.each(['/today', '/friends', '/invite?token=abc123', '/record?exercise=squat'])('%s はそのまま通す', (raw) => {
    expect(safeNextPath(raw)).toBe(raw);
  });

  // T-AUTH-FE-03: 外のサイトへ飛ばせる形は既定へ戻す（オープンリダイレクト対策）
  it.each([
    'https://evil.example',
    'http://evil.example/x',
    '//evil.example',
    '/\\evil.example',
    'javascript:alert(1)',
    'today',
    '/\t/evil.example',
    '/\n/evil.example',
  ])('%s は既定の画面へ戻す', (raw) => {
    expect(safeNextPath(raw)).toBe(DEFAULT_NEXT_PATH);
  });
});

describe('withNext（登録⇄ログインのリンク）', () => {
  // T-AUTH-FE-04: 既定の戻り先ならリンクを汚さない
  it('既定の戻り先ならクエリを付けない', () => {
    expect(withNext('/signup', DEFAULT_NEXT_PATH)).toBe('/signup');
  });

  // T-AUTH-FE-05: 招待の戻り先は、& や ? を含んでも壊れないよう符号化して付ける
  it('招待の戻り先は符号化して付ける', () => {
    expect(withNext('/login', '/invite?token=a&b=1')).toBe('/login?next=%2Finvite%3Ftoken%3Da%26b%3D1');
  });
});
