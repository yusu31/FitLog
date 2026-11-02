import { render, screen } from '@testing-library/react';
import { FORBIDDEN_WORDS } from '@/lib/forbidden-words';
import { REST_MESSAGES } from '@/lib/messages';
import { RestView } from './rest-view';

const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }), usePathname: () => '/rest/' }));
let session: { data: unknown; isPending: boolean } = { data: { user: { id: 'u1' } }, isPending: false };
vi.mock('@/lib/auth-client', () => ({ authClient: { useSession: () => session } }));

beforeEach(() => {
  replace.mockClear();
  session = { data: { user: { id: 'u1' } }, isPending: false };
});

describe('RestView（S-14 おやすみ）', () => {
  it('見出し「おやすみ」と、責めない一言を出す', () => {
    render(<RestView />);
    expect(screen.getByRole('heading', { level: 1, name: REST_MESSAGES.title })).toBeInTheDocument();
    expect(screen.getByText(REST_MESSAGES.body)).toBeInTheDocument();
  });

  it('くつろぐ姿の絵は、読み上げに余計な情報を出さない（飾りとして隠す）', () => {
    render(<RestView />);
    const figure = screen.getByTestId('rest-figure');
    expect(figure).toHaveAttribute('aria-hidden', 'true');
  });

  it('「もどる」は今日（/today）へのリンク', () => {
    render(<RestView />);
    expect(screen.getByRole('link', { name: REST_MESSAGES.back })).toHaveAttribute('href', '/today');
  });

  it('タブの無い全画面（下のタブを出さない）', () => {
    render(<RestView />);
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('ログインしていなければ、戻り先つきでログイン画面へ移す', () => {
    session = { data: null, isPending: false };
    render(<RestView />);
    expect(replace).toHaveBeenCalledWith(`/login?next=${encodeURIComponent('/rest/')}`);
  });

  it('画面の文言に、責めない言葉の禁止語が出ない', () => {
    render(<RestView />);
    for (const word of FORBIDDEN_WORDS) expect(document.body.textContent).not.toContain(word);
  });
});
