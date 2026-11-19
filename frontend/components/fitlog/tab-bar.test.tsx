import { screen, waitFor } from '@testing-library/react';
import { calls, installFakeApi, renderWithQuery } from '@/lib/test/fake-api';
import { TabBar } from './tab-bar';

const render = renderWithQuery;
beforeEach(() => installFakeApi({ 'GET /api/feed/unread': { status: 200, body: { hasNew: false } } }));
afterEach(() => vi.unstubAllGlobals());

let pathname = '/friends/';
vi.mock('next/navigation', () => ({ usePathname: () => pathname }));

describe('TabBar（下のタブ）', () => {
  // 静的書き出しは末尾に / が付く。付いていても付いていなくても、同じタブを選択中にする
  it.each(['/friends', '/friends/'])('%s では「仲間」だけが選択中（aria-current）', (path) => {
    pathname = path;
    render(<TabBar />);
    expect(screen.getByRole('link', { name: '仲間' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: '今日' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: '自分' })).not.toHaveAttribute('aria-current');
  });

  it('3つのタブが今日・仲間・自分の順で、それぞれの画面を指す', () => {
    pathname = '/today/';
    render(<TabBar />);
    const links = screen.getAllByRole('link');
    expect(links.map((l) => l.textContent)).toEqual(['今日', '仲間', '自分']);
    expect(links.map((l) => l.getAttribute('href'))).toEqual(['/today', '/friends', '/me']);
  });
});

// 新着の印（F4）。ログインしているときだけ GET /feed/unread を見て、新着があれば「仲間」に点を出す
describe('TabBar の新着の点', () => {
  it('新着があれば「仲間」に点を出し、読み上げでは「（新着あり）」と伝える', async () => {
    pathname = '/today/';
    installFakeApi({ 'GET /api/feed/unread': { status: 200, body: { hasNew: true } } });
    render(<TabBar signedIn />);
    expect(await screen.findByRole('link', { name: '仲間（新着あり）' })).toBeInTheDocument();
    expect(screen.getByTestId('friends-new-badge')).toBeInTheDocument();
  });

  it('新着がなければ点を出さない', async () => {
    pathname = '/today/';
    render(<TabBar signedIn />);
    await waitFor(() => expect(calls).toContain('GET /api/feed/unread'));
    expect(screen.queryByTestId('friends-new-badge')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '仲間' })).toBeInTheDocument();
  });

  it('仲間タブを開いている間は点を出さない（見ている最中に点を出さない）', async () => {
    pathname = '/friends/';
    installFakeApi({ 'GET /api/feed/unread': { status: 200, body: { hasNew: true } } });
    render(<TabBar signedIn />);
    await waitFor(() => expect(calls).toContain('GET /api/feed/unread'));
    expect(screen.queryByTestId('friends-new-badge')).not.toBeInTheDocument();
  });

  it('ログインしていなければ新着を問い合わせない', () => {
    pathname = '/today/';
    render(<TabBar signedIn={false} />);
    expect(calls).toHaveLength(0);
  });
});

// A04-9: 赤い点では何か分からない。件数の数字（件数が分からないときは「新」の字）にする
describe('TabBar の新着の数字', () => {
  it('新着の件数が分かれば数字を出し、読み上げでも件数を伝える', async () => {
    pathname = '/today/';
    installFakeApi({ 'GET /api/feed/unread': { status: 200, body: { hasNew: true, newCount: 3 } } });
    render(<TabBar signedIn />);
    expect(await screen.findByRole('link', { name: '仲間（新着3件）' })).toBeInTheDocument();
    expect(screen.getByTestId('friends-new-badge')).toHaveTextContent('3');
  });

  it('10件以上は 9+ と短くする', async () => {
    pathname = '/today/';
    installFakeApi({ 'GET /api/feed/unread': { status: 200, body: { hasNew: true, newCount: 12 } } });
    render(<TabBar signedIn />);
    expect(await screen.findByTestId('friends-new-badge')).toHaveTextContent('9+');
  });

  it('件数が分からないときは「新」の字を出す（無印の点にしない）', async () => {
    pathname = '/today/';
    installFakeApi({ 'GET /api/feed/unread': { status: 200, body: { hasNew: true } } });
    render(<TabBar signedIn />);
    expect(await screen.findByTestId('friends-new-badge')).toHaveTextContent('新');
  });
});
