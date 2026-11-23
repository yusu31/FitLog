import { screen } from '@testing-library/react';
import { renderWithQuery } from '@/lib/test/fake-api';
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
    renderWithQuery(<RestView />);
    expect(screen.getByRole('heading', { level: 1, name: REST_MESSAGES.title })).toBeInTheDocument();
    expect(screen.getByText(REST_MESSAGES.body)).toBeInTheDocument();
  });

  it('くつろぐ姿の絵は、読み上げに余計な情報を出さない（飾りとして隠す）', () => {
    renderWithQuery(<RestView />);
    const figure = screen.getByTestId('rest-figure');
    expect(figure).toHaveAttribute('aria-hidden', 'true');
  });

  it('「もどる」は今日（/today）へのリンク', () => {
    renderWithQuery(<RestView />);
    expect(screen.getByRole('link', { name: REST_MESSAGES.back })).toHaveAttribute('href', '/today');
  });

  it('「やっぱり記録する」は種目選び（/exercises）へのリンクで、「もどる」より先に押しやすい大きさ', () => {
    renderWithQuery(<RestView />);
    const link = screen.getByRole('link', { name: 'やっぱり記録する' });
    expect(link).toHaveAttribute('href', '/exercises');
    expect(link.className).toMatch(/min-h-11/);
  });

  it('タブの無い全画面（下のタブを出さない）', () => {
    renderWithQuery(<RestView />);
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('ログインしていなければ、戻り先つきでログイン画面へ移す', () => {
    session = { data: null, isPending: false };
    renderWithQuery(<RestView />);
    expect(replace).toHaveBeenCalledWith(`/login?next=${encodeURIComponent('/rest/')}`);
  });

  it('画面の文言に、責めない言葉の禁止語が出ない', () => {
    renderWithQuery(<RestView />);
    for (const word of FORBIDDEN_WORDS) expect(document.body.textContent).not.toContain(word);
  });
});
