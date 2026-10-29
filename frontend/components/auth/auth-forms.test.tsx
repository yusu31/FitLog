import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginForm } from './login-form';
import { SignupForm } from './signup-form';

const replace = vi.fn();
let search = '';
const signInEmail = vi.fn();
const signUpEmail = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => new URLSearchParams(search),
}));
vi.mock('@/lib/auth-client', () => ({
  authClient: {
    signIn: { email: (...args: unknown[]) => signInEmail(...args) },
    signUp: { email: (...args: unknown[]) => signUpEmail(...args) },
  },
}));

beforeEach(() => {
  replace.mockReset();
  signInEmail.mockReset();
  signUpEmail.mockReset();
  search = '';
});

async function fillLogin(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('メールアドレス'), 'a@example.com');
  await user.type(screen.getByLabelText('パスワード'), 'password123');
  await user.click(screen.getByRole('button', { name: 'ログイン' }));
}

describe('LoginForm（S-01）', () => {
  // T-AUTH-FE-10: 入力した値で signIn を呼び、成功したら既定の画面へ移る
  it('成功したらメールとパスワードを送り、今日の画面へ移る', async () => {
    signInEmail.mockResolvedValue({ data: {}, error: null });
    const user = userEvent.setup();
    render(<LoginForm />);
    await fillLogin(user);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/today'));
    expect(signInEmail).toHaveBeenCalledWith({ email: 'a@example.com', password: 'password123' });
  });

  // T-AUTH-FE-11: 招待リンクなどの戻り先（?next=）へ移る
  it('?next= のこのサイトのパスへ移る（招待リンクの値を保つ）', async () => {
    search = 'next=' + encodeURIComponent('/invite?token=abc');
    signInEmail.mockResolvedValue({ data: {}, error: null });
    const user = userEvent.setup();
    render(<LoginForm />);
    await fillLogin(user);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/invite?token=abc'));
  });

  // T-AUTH-FE-12: 外のサイトを指す戻り先には移らない
  it('?next= が外のサイトなら今日の画面へ移る', async () => {
    search = 'next=' + encodeURIComponent('https://evil.example');
    signInEmail.mockResolvedValue({ data: {}, error: null });
    const user = userEvent.setup();
    render(<LoginForm />);
    await fillLogin(user);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/today'));
  });

  // T-AUTH-FE-13: 失敗は移動せず、理由を分けずに伝える
  it('失敗したら移動せず、メールかパスワードの違いとして伝える', async () => {
    signInEmail.mockResolvedValue({ data: null, error: { code: 'INVALID_EMAIL_OR_PASSWORD' } });
    const user = userEvent.setup();
    render(<LoginForm />);
    await fillLogin(user);
    expect(await screen.findByRole('alert')).toHaveTextContent('メールアドレスかパスワードが違います');
    expect(replace).not.toHaveBeenCalled();
  });

  // T-AUTH-FE-14: 通信が切れたとき（例外）も画面が固まらず、押し直せる
  it('通信に失敗したら案内を出し、ボタンを押し直せる', async () => {
    signInEmail.mockRejectedValue(new Error('network'));
    const user = userEvent.setup();
    render(<LoginForm />);
    await fillLogin(user);
    expect(await screen.findByRole('alert')).toHaveTextContent('通信に失敗しました');
    expect(screen.getByRole('button', { name: 'ログイン' })).toBeEnabled();
  });

  // T-AUTH-FE-15: 登録画面へのリンクに戻り先が引き継がれる
  it('新規登録へのリンクに戻り先を引き継ぐ', () => {
    search = 'next=' + encodeURIComponent('/invite?token=abc');
    render(<LoginForm />);
    expect(screen.getByRole('link', { name: '新規登録' })).toHaveAttribute(
      'href',
      '/signup?next=%2Finvite%3Ftoken%3Dabc',
    );
  });
});

describe('SignupForm（S-02）', () => {
  async function fillSignup(user: ReturnType<typeof userEvent.setup>) {
    await user.type(screen.getByLabelText('表示名'), 'ゆうす');
    await user.type(screen.getByLabelText('メールアドレス'), 'a@example.com');
    await user.type(screen.getByLabelText(/パスワード/), 'password123');
    await user.click(screen.getByRole('button', { name: '登録する' }));
  }

  // T-AUTH-FE-20: 表示名・メール・パスワードを送り、成功したら戻り先へ
  it('成功したら3つの値を送り、戻り先へ移る', async () => {
    search = 'next=' + encodeURIComponent('/invite?token=abc');
    signUpEmail.mockResolvedValue({ data: {}, error: null });
    const user = userEvent.setup();
    render(<SignupForm />);
    await fillSignup(user);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/invite?token=abc'));
    expect(signUpEmail).toHaveBeenCalledWith({ name: 'ゆうす', email: 'a@example.com', password: 'password123' });
  });

  // T-AUTH-FE-21: 登録済みのメールは、ログインへ案内する日本語で伝える
  it('登録済みのメールなら、ログインを勧める', async () => {
    signUpEmail.mockResolvedValue({ data: null, error: { code: 'USER_ALREADY_EXISTS' } });
    const user = userEvent.setup();
    render(<SignupForm />);
    await fillSignup(user);
    expect(await screen.findByRole('alert')).toHaveTextContent('登録済み');
    expect(replace).not.toHaveBeenCalled();
  });

  // T-AUTH-FE-24: API が短すぎると返したときは、必要な長さ（8）を伝える
  it('パスワードが短いと返されたら、8文字以上を伝える', async () => {
    signUpEmail.mockResolvedValue({ data: null, error: { code: 'PASSWORD_TOO_SHORT' } });
    const user = userEvent.setup();
    render(<SignupForm />);
    await fillSignup(user);
    expect(await screen.findByRole('alert')).toHaveTextContent('パスワードは8文字以上');
  });

  // T-AUTH-FE-22: 知らないエラーコードでも、英語の生メッセージは見せない
  it('知らないエラーでも汎用の日本語を出す', async () => {
    signUpEmail.mockResolvedValue({ data: null, error: { code: 'SOMETHING_NEW', message: 'raw english' } });
    const user = userEvent.setup();
    render(<SignupForm />);
    await fillSignup(user);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('登録できませんでした');
    expect(alert).not.toHaveTextContent('raw english');
  });

  // T-AUTH-FE-23: パスワードの境界（8文字）。ブラウザの入力検査に最小の長さを渡している
  it('パスワード欄に8文字以上の制限を付ける', () => {
    render(<SignupForm />);
    expect(screen.getByLabelText(/パスワード/)).toHaveAttribute('minlength', '8');
  });
});
