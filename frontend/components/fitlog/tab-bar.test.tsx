import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
    expect(screen.getByRole('link', { name: 'ホーム' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: '自分' })).not.toHaveAttribute('aria-current');
  });

  it('4つのタブがホーム・記録・仲間・自分の順で、それぞれの画面を指す（＋はタブではなくボタン）', () => {
    pathname = '/log/';
    render(<TabBar />);
    // 扇の丸（筋トレ・ラン…）もリンクなので、タブだけに絞る
    const links = screen.getAllByRole('link').filter((l) => !l.closest('[role="group"]'));
    expect(links.map((l) => l.textContent)).toEqual(['ホーム', '記録', '仲間', '自分']);
    expect(links.map((l) => l.getAttribute('href'))).toEqual(['/home', '/log', '/friends', '/me']);
    expect(screen.getByRole('button', { name: '記録を始める' })).toBeInTheDocument();
  });

  it('/me/posts など自分の下の画面でも「自分」が選択中。/log では「記録」だけが選択中', () => {
    pathname = '/me/posts/';
    const first = render(<TabBar />);
    expect(screen.getByRole('link', { name: '自分' })).toHaveAttribute('aria-current', 'page');
    first.unmount();
    pathname = '/log/';
    render(<TabBar />);
    expect(screen.getByRole('link', { name: '記録' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: '自分' })).not.toHaveAttribute('aria-current');
  });

  it('中央の ● を押すと扇が開き、行き先は筋トレ・ラン・おやすみ（撮影も）。もう一度押すと閉じる（動きは start-fan.test.tsx）', async () => {
    pathname = '/log/';
    const user = userEvent.setup();
    render(<TabBar />);
    await user.click(screen.getByRole('button', { name: '記録を始める' }));
    const menu = screen.getByRole('group', { name: '記録のメニュー' });
    expect(within(menu).getByRole('link', { name: '筋トレ' })).toHaveAttribute('href', '/exercises');
    expect(within(menu).getByRole('link', { name: 'ラン' })).toHaveAttribute('href', '/run');
    expect(within(menu).getByRole('link', { name: 'おやすみ' })).toHaveAttribute('href', '/rest');
    await user.click(screen.getByRole('button', { name: '記録を始める' }));
    expect(screen.getByRole('button', { name: '記録を始める' })).toHaveAttribute('aria-expanded', 'false');
  });
});

// 新着の印（F4）。ログインしているときだけ GET /feed/unread を見て、新着があれば「ホーム」に点を出す
describe('TabBar の新着の点', () => {
  it('新着があれば「ホーム」に点を出し、読み上げでは「（新着あり）」と伝える', async () => {
    pathname = '/log/';
    installFakeApi({ 'GET /api/feed/unread': { status: 200, body: { hasNew: true } } });
    render(<TabBar signedIn />);
    expect(await screen.findByRole('link', { name: 'ホーム（新着あり）' })).toBeInTheDocument();
    expect(screen.getByTestId('friends-new-badge')).toBeInTheDocument();
  });

  it('新着がなければ点を出さない', async () => {
    pathname = '/log/';
    render(<TabBar signedIn />);
    await waitFor(() => expect(calls).toContain('GET /api/feed/unread'));
    expect(screen.queryByTestId('friends-new-badge')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'ホーム' })).toBeInTheDocument();
  });

  it('ホームを開いている間は点を出さない（見ている最中に点を出さない）', async () => {
    pathname = '/home/';
    installFakeApi({ 'GET /api/feed/unread': { status: 200, body: { hasNew: true } } });
    render(<TabBar signedIn />);
    await waitFor(() => expect(calls).toContain('GET /api/feed/unread'));
    expect(screen.queryByTestId('friends-new-badge')).not.toBeInTheDocument();
  });

  it('ログインしていなければ新着を問い合わせない', () => {
    pathname = '/log/';
    render(<TabBar signedIn={false} />);
    expect(calls).toHaveLength(0);
  });
});

// A04-9: 赤い点では何か分からない。件数の数字（件数が分からないときは「新」の字）にする
describe('TabBar の新着の数字', () => {
  it('新着の件数が分かれば数字を出し、読み上げでも件数を伝える', async () => {
    pathname = '/log/';
    installFakeApi({ 'GET /api/feed/unread': { status: 200, body: { hasNew: true, newCount: 3 } } });
    render(<TabBar signedIn />);
    expect(await screen.findByRole('link', { name: 'ホーム（新着3件）' })).toBeInTheDocument();
    expect(screen.getByTestId('friends-new-badge')).toHaveTextContent('3');
  });

  it('10件以上は 9+ と短くする', async () => {
    pathname = '/log/';
    installFakeApi({ 'GET /api/feed/unread': { status: 200, body: { hasNew: true, newCount: 12 } } });
    render(<TabBar signedIn />);
    expect(await screen.findByTestId('friends-new-badge')).toHaveTextContent('9+');
  });

  it('件数が分からないときは「新」の字を出す（無印の点にしない）', async () => {
    pathname = '/log/';
    installFakeApi({ 'GET /api/feed/unread': { status: 200, body: { hasNew: true } } });
    render(<TabBar signedIn />);
    expect(await screen.findByTestId('friends-new-badge')).toHaveTextContent('新');
  });
});

describe('TabBar（狭い画面。L2）', () => {
  it('各タブと START は幅を縮められる形（min-w-0・flex-1・最大64px／56px）で、はみ出さない', () => {
    pathname = '/log/';
    render(<TabBar />);
    for (const name of ['ホーム', '記録', '仲間', '自分']) {
      const li = screen.getByRole('link', { name }).closest('li')!;
      expect(li).toHaveClass('min-w-0', 'flex-1', 'max-w-16');
      expect(screen.getByRole('link', { name })).toHaveClass('w-full');
    }
    const start = screen.getByRole('button', { name: '記録を始める' });
    expect(start.closest('li')).toHaveClass('min-w-0', 'flex-1', 'max-w-14');
    expect(start).toHaveClass('aspect-square', 'w-full', 'max-w-14');
  });

  it('195px 幅などの狭い画面では、文字を消してアイコンだけにする（読み上げの名前は残す）', () => {
    pathname = '/log/';
    render(<TabBar />);
    const label = screen.getByText('ホーム');
    expect(label).toHaveClass('max-[239px]:sr-only');
    expect(screen.getByRole('link', { name: 'ホーム' })).toBeInTheDocument();
  });
});
