import { render, screen } from '@testing-library/react';
import Home from './page';

const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));

describe('Home（最初の画面）', () => {
  // T-FE-01: アプリ名が見出しで見える（移る前の一瞬）
  it('アプリ名 FitLog を見出しで表示し、雛形の宣伝は出さない', () => {
    render(<Home />);
    expect(screen.getByRole('heading', { level: 1, name: 'FitLog' })).toBeInTheDocument();
    expect(screen.queryByAltText('Next.js logo')).not.toBeInTheDocument();
  });

  // T-FE-02: ホームへ移す（ログインしていなければ、枠がログイン画面へ移す）
  it('ホームへ移す', () => {
    render(<Home />);
    expect(replace).toHaveBeenCalledWith('/home');
  });
});

describe('Home（最初に開くタブ。D6-5）', () => {
  afterEach(() => {
    localStorage.removeItem('fitlog-prefs');
    replace.mockClear();
  });

  it('設定が「仲間」なら、仲間の画面へ移す', () => {
    localStorage.setItem('fitlog-prefs', JSON.stringify({ firstTab: 'friends' }));
    render(<Home />);
    expect(replace).toHaveBeenCalledWith('/friends');
  });
});
