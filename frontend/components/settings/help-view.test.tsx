import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GPS_NOTICE_SEEN_KEY } from '@/lib/gps/device';
import { FORBIDDEN_WORDS } from '@/lib/forbidden-words';
import { DISMISSED_KEY } from './add-to-home';
import { FAQ, HelpView } from './help-view';

vi.mock('@/lib/use-require-session', () => ({ useRequireSession: () => ({ signedIn: true }) }));

afterEach(() => {
  localStorage.removeItem(DISMISSED_KEY);
  localStorage.removeItem(GPS_NOTICE_SEEN_KEY);
});

describe('HelpView（ヘルプ・使い方。D6-5）', () => {
  it('見出しと、設定へ戻るリンクを出す', () => {
    render(<HelpView />);
    expect(screen.getByRole('heading', { level: 1, name: 'ヘルプ・使い方' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '設定へ戻る' })).toHaveAttribute('href', '/settings');
  });

  it('よくある質問を、開閉できる形ですべて出す', () => {
    render(<HelpView />);
    expect(FAQ.length).toBeGreaterThan(5);
    for (const { q } of FAQ) expect(screen.getByText(q)).toBeInTheDocument();
    expect(document.querySelectorAll('details')).toHaveLength(FAQ.length);
  });

  it('「案内をもう一度出す」で、ホーム画面に追加とランの案内の「見た」印を消す', async () => {
    localStorage.setItem(DISMISSED_KEY, '1');
    localStorage.setItem(GPS_NOTICE_SEEN_KEY, '1');
    const user = userEvent.setup();
    render(<HelpView />);
    await user.click(screen.getByRole('button', { name: '案内をもう一度出す' }));
    expect(localStorage.getItem(DISMISSED_KEY)).toBeNull();
    expect(localStorage.getItem(GPS_NOTICE_SEEN_KEY)).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent('出すようにしました');
  });

  it('文言に、使ってはいけない語を含まない', () => {
    render(<HelpView />);
    const text = document.body.textContent ?? '';
    for (const word of FORBIDDEN_WORDS) expect(text).not.toContain(word);
  });
});
