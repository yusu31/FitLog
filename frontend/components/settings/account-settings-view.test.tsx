import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FORBIDDEN_WORDS } from '@/lib/forbidden-words';
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
  session = SIGNED_IN;
  replace.mockClear();
  updateUser.mockReset();
  changePassword.mockReset();
  updateUser.mockResolvedValue({ data: {}, error: null });
  changePassword.mockResolvedValue({ data: {}, error: null });
});

describe('AccountSettingsView（アカウントの設定）', () => {
  it('見出しと、設定へ戻るリンクを出す', () => {
    render(<AccountSettingsView />);
    expect(screen.getByRole('heading', { level: 1, name: 'アカウントの設定' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '設定へ戻る' })).toHaveAttribute('href', '/settings');
  });

  it('表示名の欄に今の名前が入っていて、30 文字までに制限する', () => {
    render(<AccountSettingsView />);
    const input = screen.getByLabelText('表示名');
    expect(input).toHaveValue('たろう');
    expect(input).toHaveAttribute('maxlength', '30');
  });

  it('表示名を変えて保存すると updateUser を呼び、保存できたことを知らせる', async () => {
    const user = userEvent.setup();
    render(<AccountSettingsView />);
    const input = screen.getByLabelText('表示名');
    await user.clear(input);
    await user.type(input, 'はなこ');
    await user.click(screen.getByRole('button', { name: '名前を保存する' }));
    expect(updateUser).toHaveBeenCalledWith({ name: 'はなこ' });
    expect(await screen.findByRole('status')).toHaveTextContent('保存しました');
  });

  it('表示名が空白だけなら、送らずに知らせる', async () => {
    const user = userEvent.setup();
    render(<AccountSettingsView />);
    const input = screen.getByLabelText('表示名');
    await user.clear(input);
    await user.type(input, '   ');
    await user.click(screen.getByRole('button', { name: '名前を保存する' }));
    expect(updateUser).not.toHaveBeenCalled();
    expect(await screen.findByRole('alert')).toHaveTextContent('表示名');
  });

  it('名前の保存が通信で止まったら、責めない文言で知らせる', async () => {
    updateUser.mockRejectedValue(new TypeError('Failed to fetch'));
    const user = userEvent.setup();
    render(<AccountSettingsView />);
    await user.click(screen.getByRole('button', { name: '名前を保存する' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('通信できませんでした');
  });

  it('パスワードを変えると、他の端末のログインを外す指定つきで changePassword を呼ぶ', async () => {
    const user = userEvent.setup();
    render(<AccountSettingsView />);
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
    render(<AccountSettingsView />);
    await user.type(screen.getByLabelText('今のパスワード'), 'wrong-password-1');
    await user.type(screen.getByLabelText('新しいパスワード（8文字以上）'), 'new-password-123');
    await user.click(screen.getByRole('button', { name: 'パスワードを変更する' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('今のパスワードが違います');
  });

  it('ログインしていなければ、戻り先つきでログイン画面へ移す', () => {
    session = { data: null, isPending: false };
    render(<AccountSettingsView />);
    expect(replace).toHaveBeenCalledWith('/login?next=%2Fsettings%2Faccount%2F');
    expect(screen.queryByLabelText('表示名')).not.toBeInTheDocument();
  });

  it('画面の文言に、使ってはいけない語を含まない', () => {
    render(<AccountSettingsView />);
    const text = document.body.textContent ?? '';
    for (const word of FORBIDDEN_WORDS) expect(text).not.toContain(word);
  });
});
