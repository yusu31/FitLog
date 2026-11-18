import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FORBIDDEN_WORDS } from '@/lib/forbidden-words';
import { DeleteAccount } from './delete-account';

const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));
const deleteUser = vi.fn();
vi.mock('@/lib/auth-client', () => ({ authClient: { deleteUser: (...args: unknown[]) => deleteUser(...args) } }));

beforeEach(() => {
  replace.mockClear();
  deleteUser.mockReset();
  deleteUser.mockResolvedValue({ data: { success: true }, error: null });
});

// 退会（F2-b）。消えるものを先に見せ、パスワードを入れてもらってから消す（元に戻せないため。猶予は置かない）
describe('DeleteAccount（退会）', () => {
  const openConfirm = async (user: ReturnType<typeof userEvent.setup>) => {
    render(<DeleteAccount />);
    await user.click(screen.getByRole('button', { name: '退会の手続きへ' }));
  };

  it('最初は確認の欄を出さず、「退会の手続きへ」を押すと、消えるものの説明とパスワード欄を出す', async () => {
    const user = userEvent.setup();
    render(<DeleteAccount />);
    expect(screen.queryByLabelText('パスワード（確認のため）')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '退会の手続きへ' }));
    const section = screen.getByRole('region', { name: '退会' });
    expect(section).toHaveTextContent('記録');
    expect(section).toHaveTextContent('動画');
    expect(section).toHaveTextContent('スタンプ');
    expect(section).toHaveTextContent('元に戻せません');
    expect(screen.getByLabelText('パスワード（確認のため）')).toBeInTheDocument();
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it('「やめる」で確認の欄を閉じ、何も送らない', async () => {
    const user = userEvent.setup();
    await openConfirm(user);
    await user.type(screen.getByLabelText('パスワード（確認のため）'), 'abc');
    await user.click(screen.getByRole('button', { name: 'やめる' }));
    expect(screen.queryByLabelText('パスワード（確認のため）')).not.toBeInTheDocument();
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it('パスワードを入れて「完全に退会する」を押すと、deleteUser を呼び、ログイン画面へ移す', async () => {
    const user = userEvent.setup();
    await openConfirm(user);
    await user.type(screen.getByLabelText('パスワード（確認のため）'), 'correct-horse-battery');
    await user.click(screen.getByRole('button', { name: '完全に退会する' }));
    expect(deleteUser).toHaveBeenCalledWith({ password: 'correct-horse-battery' });
    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
  });

  it('パスワードが違うときは、その旨を知らせ、ログイン画面へは移さない', async () => {
    deleteUser.mockResolvedValue({ data: null, error: { code: 'INVALID_PASSWORD', message: 'Invalid password' } });
    const user = userEvent.setup();
    await openConfirm(user);
    await user.type(screen.getByLabelText('パスワード（確認のため）'), 'wrong-password-1');
    await user.click(screen.getByRole('button', { name: '完全に退会する' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('パスワードが違います');
    expect(replace).not.toHaveBeenCalledWith('/login');
  });

  it('通信が止まったときは、責めない文言で知らせ、ログイン画面へは移さない', async () => {
    deleteUser.mockRejectedValue(new TypeError('Failed to fetch'));
    const user = userEvent.setup();
    await openConfirm(user);
    await user.type(screen.getByLabelText('パスワード（確認のため）'), 'correct-horse-battery');
    await user.click(screen.getByRole('button', { name: '完全に退会する' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('通信できませんでした');
    expect(replace).not.toHaveBeenCalledWith('/login');
  });

  it('画面の文言に、使ってはいけない語を含まない', async () => {
    const user = userEvent.setup();
    await openConfirm(user);
    const text = document.body.textContent ?? '';
    for (const word of FORBIDDEN_WORDS) expect(text).not.toContain(word);
  });
});
