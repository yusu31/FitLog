import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FORBIDDEN_WORDS } from '@/lib/forbidden-words';
import { SettingsView } from './settings-view';

const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }), usePathname: () => '/settings/' }));
const signOut = vi.fn();
let session: { data: unknown; isPending: boolean } = { data: null, isPending: false };
vi.mock('@/lib/auth-client', () => ({ authClient: { useSession: () => session, signOut: (...args: unknown[]) => signOut(...args) } }));

const SIGNED_IN = { data: { user: { id: 'u1', name: 'たろう', email: 'taro@example.com' } }, isPending: false };
const GROUP = { id: 'g1', name: '朝トレ部', members: [{ id: 'u1', name: 'たろう', avatar: {} }] };

let groupReply: { status: number; body?: unknown } = { status: 200, body: GROUP };
beforeEach(() => {
  session = SIGNED_IN;
  groupReply = { status: 200, body: GROUP };
  replace.mockClear();
  signOut.mockReset();
  signOut.mockResolvedValue(undefined);
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (url !== '/api/groups/current') throw new Error(`想定外の呼び出し: ${url}`);
      return new Response(JSON.stringify(groupReply.body ?? {}), { status: groupReply.status, headers: { 'Content-Type': 'application/json' } });
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

const renderView = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <SettingsView />
    </QueryClientProvider>,
  );
};

describe('SettingsView（S-31 設定）', () => {
  it('見出しと、自分タブへ戻るリンクを出す', () => {
    renderView();
    expect(screen.getByRole('heading', { level: 1, name: '設定' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '自分へ戻る' })).toHaveAttribute('href', '/me');
  });

  it('ユーザー情報（表示名・メール）を出す', () => {
    renderView();
    const section = screen.getByRole('region', { name: 'ユーザー情報' });
    expect(section).toHaveTextContent('たろう');
    expect(section).toHaveTextContent('taro@example.com');
  });

  it('グループに入っていれば、グループ名を出し、グループの設定（S-32）へのリンクにする', async () => {
    renderView();
    const link = await screen.findByRole('link', { name: /朝トレ部/ });
    expect(link).toHaveAttribute('href', '/settings/group');
  });

  it('グループに入っていなければ「グループに入っていません」と出し、S-32 へのリンクは残す', async () => {
    groupReply = { status: 404, body: { code: 'GROUP_NOT_FOUND', message: 'グループに入っていません' } };
    renderView();
    const link = await screen.findByRole('link', { name: /グループに入っていません/ });
    expect(link).toHaveAttribute('href', '/settings/group');
  });

  it('グループの読み込み中は骨組みを出す', () => {
    renderView();
    expect(screen.getByLabelText('グループを読み込み中')).toHaveAttribute('aria-busy', 'true');
  });

  it('キャラ（S-33）とクレジット（S-34）は、押せない見た目だけ（リンクにしない）', () => {
    renderView();
    for (const name of ['キャラの編集', 'クレジット']) {
      const row = screen.getByRole('button', { name: new RegExp(name) });
      expect(row).toBeDisabled();
      expect(screen.queryByRole('link', { name: new RegExp(name) })).not.toBeInTheDocument();
    }
    expect(screen.getAllByText('準備中')).toHaveLength(2);
  });

  it('ログアウトを押すと signOut を呼び、ログイン画面へ移す', async () => {
    const user = userEvent.setup();
    renderView();
    await user.click(screen.getByRole('button', { name: 'ログアウト' }));
    expect(signOut).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
  });

  it('ログアウトが通信で止まったら、ログイン画面へは移さず、責めない文言で知らせる', async () => {
    signOut.mockRejectedValue(new TypeError('Failed to fetch'));
    const user = userEvent.setup();
    renderView();
    await user.click(screen.getByRole('button', { name: 'ログアウト' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('通信できませんでした');
    expect(replace).not.toHaveBeenCalledWith('/login');
  });

  it('ログインしていなければ、戻り先つきでログイン画面へ移す（ユーザー情報は出さない）', () => {
    session = { data: null, isPending: false };
    renderView();
    expect(replace).toHaveBeenCalledWith('/login?next=%2Fsettings%2F');
    expect(screen.queryByText('taro@example.com')).not.toBeInTheDocument();
  });

  it('画面の文言に、使ってはいけない語を含まない', async () => {
    renderView();
    await screen.findByRole('link', { name: /朝トレ部/ });
    const text = document.body.textContent ?? '';
    for (const word of FORBIDDEN_WORDS) expect(text).not.toContain(word);
  });
});
