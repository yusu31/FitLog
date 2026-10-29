import { render, screen } from '@testing-library/react';
import { AppShell } from './app-shell';

const replace = vi.fn();
let session: { data: unknown; isPending: boolean } = { data: null, isPending: false };
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }), usePathname: () => '/friends/' }));
vi.mock('@/lib/auth-client', () => ({ authClient: { useSession: () => session } }));

beforeEach(() => replace.mockReset());

describe('AppShell（タブのある画面の枠）', () => {
  // 未ログインなら、戻り先つきでログイン画面へ。中身は描かない
  it('ログインしていなければ /login?next= へ移し、中身を出さない', () => {
    session = { data: null, isPending: false };
    render(<AppShell>ひみつの中身</AppShell>);
    expect(replace).toHaveBeenCalledWith('/login?next=%2Ffriends%2F');
    expect(screen.queryByText('ひみつの中身')).not.toBeInTheDocument();
  });

  // 確かめている間は移さず、読み込み中を出す（ログイン済みの人を一瞬ログイン画面へ飛ばさない）
  it('確かめている間は移さず、読み込み中を出す', () => {
    session = { data: null, isPending: true };
    render(<AppShell>中身</AppShell>);
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByLabelText('読み込み中')).toBeInTheDocument();
  });

  it('ログイン済みなら中身と下のタブを出す', () => {
    session = { data: { user: { id: 'u1', name: 'たろう' } }, isPending: false };
    render(<AppShell>中身</AppShell>);
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByText('中身')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'メイン' })).toBeInTheDocument();
  });
});
