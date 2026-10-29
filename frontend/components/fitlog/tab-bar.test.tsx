import { render, screen } from '@testing-library/react';
import { TabBar } from './tab-bar';

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
