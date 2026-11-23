import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FORBIDDEN_WORDS } from '@/lib/forbidden-words';
import { renderWithQuery, installFakeApi } from '@/lib/test/fake-api';
import { AccountSettingsView } from './account-settings-view';

const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }), usePathname: () => '/settings/account/' }));
const updateUser = vi.fn();
const changePassword = vi.fn();
let session: { data: unknown; isPending: boolean } = { data: null, isPending: false };
vi.mock('@/lib/auth-client', () => ({
  authClient: {
    useSession: () => session,
    updateUser: (...args: unknown[]) => updateUser(...args),
    changePassword: (...args: unknown[]) => changePassword(...args),
  },
}));

const SIGNED_IN = { data: { user: { id: 'u1', name: 'たろう', email: 'taro@example.com' } }, isPending: false };

beforeEach(() => {
  installFakeApi({});
  session = SIGNED_IN;
  replace.mockClear();
  updateUser.mockReset();
  changePassword.mockReset();
  updateUser.mockResolvedValue({ data: {}, error: null });
  changePassword.mockResolvedValue({ data: {}, error: null });
});

describe('AccountSettingsView（アカウントの設定）', () => {
  it('B14b: 身長・プロフィールの編集（からだ）の区画がある', async () => {
    installFakeApi({
      'GET /api/body': { status: 200, body: { heightCm: 170, latest: null, bmi: null, avg7: null, deltaFromPrevious: null, weights: [] } },
      'GET /api/body/profile': { status: 200, body: { userId: 'u1', name: 'たろう', bio: null, favoriteKind: null, activeTime: null } },
    });
    renderWithQuery(<AccountSettingsView />);
    expect(await screen.findByLabelText('身長（cm）')).toHaveValue('170');
    expect(screen.getByLabelText('ひとこと')).toBeInTheDocument();
  });

  it('見出しと、設定へ戻るリンクを出す', () => {
    renderWithQuery(<AccountSettingsView />);
    expect(screen.getByRole('heading', { level: 1, name: 'アカウントの設定' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '設定へ戻る' })).toHaveAttribute('href', '/settings');
  });

  it('表示名はここに無い（設定の上の1か所だけ）', () => {
    renderWithQuery(<AccountSettingsView />);
    expect(screen.queryByLabelText('表示名')).not.toBeInTheDocument();
  });

  it('パスワードを変えると、他の端末のログインを外す指定つきで changePassword を呼ぶ', async () => {
    const user = userEvent.setup();
    renderWithQuery(<AccountSettingsView />);
    await user.type(screen.getByLabelText('今のパスワード'), 'correct-horse-battery');
    await user.type(screen.getByLabelText('新しいパスワード（8文字以上）'), 'new-password-123');
    await user.click(screen.getByRole('button', { name: 'パスワードを変更する' }));
    expect(changePassword).toHaveBeenCalledWith({
      currentPassword: 'correct-horse-battery',
      newPassword: 'new-password-123',
      revokeOtherSessions: true,
    });
    expect(await screen.findByRole('status')).toHaveTextContent('変更しました');
    // 変更後は入力欄を空に戻す（パスワードを画面に残さない）
    expect(screen.getByLabelText('今のパスワード')).toHaveValue('');
  });

  it('今のパスワードが違うときは、その旨を日本語で知らせる', async () => {
    changePassword.mockResolvedValue({ data: null, error: { code: 'INVALID_PASSWORD', message: 'Invalid password' } });
    const user = userEvent.setup();
    renderWithQuery(<AccountSettingsView />);
    await user.type(screen.getByLabelText('今のパスワード'), 'wrong-password-1');
    await user.type(screen.getByLabelText('新しいパスワード（8文字以上）'), 'new-password-123');
    await user.click(screen.getByRole('button', { name: 'パスワードを変更する' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('今のパスワードが違います');
  });

  it('ログインしていなければ、戻り先つきでログイン画面へ移す', () => {
    session = { data: null, isPending: false };
    renderWithQuery(<AccountSettingsView />);
    expect(replace).toHaveBeenCalledWith('/login?next=%2Fsettings%2Faccount%2F');
    expect(screen.queryByLabelText('表示名')).not.toBeInTheDocument();
  });

  it('画面の文言に、使ってはいけない語を含まない', () => {
    renderWithQuery(<AccountSettingsView />);
    const text = document.body.textContent ?? '';
    for (const word of FORBIDDEN_WORDS) expect(text).not.toContain(word);
  });
});
