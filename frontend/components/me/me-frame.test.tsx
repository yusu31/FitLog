import { render, screen, within } from '@testing-library/react';
import { MeFrame } from './me-frame';

let pathname = '/me/';
vi.mock('next/navigation', () => ({ usePathname: () => pathname }));

// 自分タブの枠（02-9 ⑫）: 見出し「自分」・右上の設定（歯車）・3つのタブ（レポート・投稿・プロフィール）
describe('MeFrame（自分タブの枠）', () => {
  it('見出し「自分」と同じ行に、設定への歯車のリンクがある（ログアウトは置かない）', () => {
    render(<MeFrame>中身</MeFrame>);
    const h1 = screen.getByRole('heading', { level: 1, name: '自分' });
    const gear = screen.getByRole('link', { name: '設定' });
    expect(gear).toHaveAttribute('href', '/settings');
    expect(h1.parentElement).toContainElement(gear);
    expect(screen.queryByRole('button', { name: 'ログアウト' })).not.toBeInTheDocument();
    expect(screen.getByText('中身')).toBeInTheDocument();
  });

  it.each([
    ['/me/', 'レポート'],
    ['/me', 'レポート'],
    ['/me/posts/', '投稿'],
    ['/me/profile/', 'プロフィール'],
  ])('%s では「%s」だけが選択中（aria-current）', (path, label) => {
    pathname = path;
    render(<MeFrame>中身</MeFrame>);
    const tabs = within(screen.getByRole('navigation', { name: '自分の画面' })).getAllByRole('link');
    expect(tabs.map((l) => l.textContent)).toEqual(['レポート', '投稿', 'プロフィール']);
    expect(tabs.map((l) => l.getAttribute('href'))).toEqual(['/me', '/me/posts', '/me/profile']);
    expect(tabs.filter((l) => l.getAttribute('aria-current') === 'page').map((l) => l.textContent)).toEqual([label]);
  });
});
