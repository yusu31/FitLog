import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginForm } from './login-form';
import { SignupForm } from './signup-form';

const replace = vi.fn();
let search = '';
const signInEmail = vi.fn();
const signUpEmail = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
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
  window.history.replaceState(null, '', '/login');
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
    window.history.replaceState(null, '', '/login?' + search);
    signInEmail.mockResolvedValue({ data: {}, error: null });
    const user = userEvent.setup();
    render(<LoginForm />);
    await fillLogin(user);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/invite?token=abc'));
  });

  // T-AUTH-FE-12: 外のサイトを指す戻り先には移らない
  it('?next= が外のサイトなら今日の画面へ移る', async () => {
    search = 'next=' + encodeURIComponent('https://evil.example');
    window.history.replaceState(null, '', '/login?' + search);
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
    window.history.replaceState(null, '', '/login?' + search);
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
    await user.click(screen.getByRole('checkbox', { name: /同意/ }));
    await user.click(screen.getByRole('button', { name: '登録する' }));
  }

  // T-AUTH-FE-20: 表示名・メール・パスワードを送り、成功したら戻り先へ
  it('成功したら3つの値を送り、戻り先へ移る', async () => {
    search = 'next=' + encodeURIComponent('/invite?token=abc');
    window.history.replaceState(null, '', '/login?' + search);
    signUpEmail.mockResolvedValue({ data: {}, error: null });
    const user = userEvent.setup();
    render(<SignupForm />);
    await fillSignup(user);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/invite?token=abc'), { timeout: 4000 });
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

  // T-AUTH-FE-25: 入力が不正なら送らず、直す点を日本語で role=alert に出す（A13-7）
  it.each([
    ['表示名が空', { name: '', email: 'a@example.com', password: 'password123' }, '表示名を入力してください'],
    ['メールの形が違う', { name: 'ゆうす', email: 'abc', password: 'password123' }, 'メールアドレスの形が正しくありません'],
    ['パスワードが短い', { name: 'ゆうす', email: 'a@example.com', password: 'short' }, 'パスワードは8文字以上'],
  ])('%s: 送らずにエラー文を出す', async (_label, v, text) => {
    const user = userEvent.setup();
    render(<SignupForm />);
    if (v.name) await user.type(screen.getByLabelText('表示名'), v.name);
    await user.type(screen.getByLabelText('メールアドレス'), v.email);
    await user.type(screen.getByLabelText(/パスワード/), v.password);
    await user.click(screen.getByRole('button', { name: '登録する' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(text);
    expect(signUpEmail).not.toHaveBeenCalled();
  });

  // D1: 規約とプライバシーへの同意は必須。チェックしないと送らず、リンクは別タブで開く
  it('同意にチェックが無いと送らず、直す点を出す。規約・プライバシーのリンクは別タブ', async () => {
    const user = userEvent.setup();
    render(<SignupForm />);
    await user.type(screen.getByLabelText('表示名'), 'ゆうす');
    await user.type(screen.getByLabelText('メールアドレス'), 'a@example.com');
    await user.type(screen.getByLabelText(/パスワード/), 'password123');
    expect(screen.getByRole('checkbox', { name: /同意/ })).not.toBeChecked();
    await user.click(screen.getByRole('button', { name: '登録する' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('同意が必要です');
    expect(signUpEmail).not.toHaveBeenCalled();
    for (const [name, href] of [['利用規約', '/terms'], ['プライバシーの扱い', '/privacy']]) {
      const link = screen.getByRole('link', { name });
      expect(link).toHaveAttribute('href', href);
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
    }
  });

  // T-AUTH-FE-23: パスワードの境界（8文字）。ブラウザの入力検査に最小の長さを渡している
  it('パスワード欄に8文字以上の制限を付ける', () => {
    render(<SignupForm />);
    expect(screen.getByLabelText(/パスワード/)).toHaveAttribute('minlength', '8');
  });
});

// S2: 静的書き出しの HTML にフォームが入っていること（JS が動く前の最初の表示。遅い回線で空白が続かないため）
describe('ログイン・登録ページの最初の HTML（S2）', () => {
  it.each([
    ['ログイン', async () => (await import('@/app/login/page')).default, 'メールアドレス'],
    ['新規登録', async () => (await import('@/app/signup/page')).default, 'メールアドレス'],
  ])('%s: JS なしで描いた HTML にフォームの項目が入る', async (_name, load, label) => {
    const { renderToString } = await import('react-dom/server');
    const Page = await load();
    expect(renderToString(<Page />)).toContain(label);
  });
});

// D1: 3行の紹介文はやめた（上の帯はロゴと一言だけ。ログインは筋トレ版／ラン版の見本）
describe('アプリの紹介（F8 → D1 で3行をやめた）', () => {
  it.each([
    ['ログイン', <LoginForm key="l" />],
    ['新規登録', <SignupForm key="s" />],
  ])('%s画面に3行の紹介文は出さない', (_name, ui) => {
    render(ui);
    expect(screen.queryByRole('list', { name: 'FitLogでできること' })).not.toBeInTheDocument();
  });
});

// D1: ログインの上半分は、この端末で最後に保存した運動の種類で切り替わる（初回は筋トレ版）
describe('ログインの上半分（D1）', () => {
  afterEach(() => localStorage.clear());

  it('覚えていないときは筋トレ版（トレーニング中のキャラと前回の重さ）', () => {
    render(<LoginForm />);
    const hero = screen.getByTestId('login-hero');
    expect(hero).toHaveAttribute('data-kind', 'lift');
    expect(hero).toHaveTextContent('60kg × 8');
    expect(within(hero).getByTestId('sprite')).toHaveAttribute('data-pose', 'train');
  });

  it('最後に保存したのがランなら、ラン版（走るキャラと薄い前回の自分・前回の距離）', () => {
    localStorage.setItem('fitlog-last-kind', 'run');
    render(<LoginForm />);
    const hero = screen.getByTestId('login-hero');
    expect(hero).toHaveAttribute('data-kind', 'run');
    expect(hero).toHaveTextContent('5.0km');
    expect(within(hero).getAllByTestId('sprite').map((e) => e.getAttribute('data-pose'))).toEqual(['run', 'run']);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('前回の自分と並んで走る');
  });

  it('登録画面は入力欄が上。上の帯はロゴと一言だけ（キャラ・見本の枠は出さない）', () => {
    render(<SignupForm />);
    expect(screen.queryByTestId('login-hero')).not.toBeInTheDocument();
    expect(screen.queryByTestId('sprite')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('前回の自分と並べて記録');
  });
});

// A01-1: 最初の画面で「何ができるか」が大見出しになり、実画面の見本（今日・仲間）が見える
describe('入口の見出しと見本（A01-1）', () => {
  it.each([
    ['ログイン', <LoginForm key="l" />],
    ['新規登録', <SignupForm key="s" />],
  ])('%s: 大見出しは何ができるかの一文で、今日と仲間の見本画像がある', (_name, ui) => {
    render(ui);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('前回の自分と並べて記録');
    expect(screen.getByRole('img', { name: '今日の画面の見本' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '仲間の画面の見本' })).toBeInTheDocument();
  });

  it('ログインか新規登録かは、フォームの見出し（h2）で分かる', () => {
    render(<LoginForm />);
    expect(screen.getByRole('heading', { level: 2, name: 'ログイン' })).toBeInTheDocument();
  });
});

// A01-2: 新規登録は塗りの大きなボタン（リンク）としてログインと並ぶ。N-06: 登録画面の「ログイン」も24px以上
describe('入口のボタン（A01-2・N-06）', () => {
  it('ログイン画面の「新規登録」は厚みボタンの見た目のリンク', () => {
    render(<LoginForm />);
    const link = screen.getByRole('link', { name: '新規登録' });
    expect(link.className).toContain('fl-thick');
    expect(link.className).toContain('min-h-11');
  });

  it('登録画面の「ログイン」リンクも44px以上の高さを持つ', () => {
    render(<SignupForm />);
    const link = screen.getByRole('link', { name: 'ログイン' });
    expect(link.className).toContain('min-h-11');
  });
});

// A01-4: 入力欄の使い道の説明
describe('入力欄の説明（A01-4）', () => {
  it('表示名とメールアドレスの使い道が、欄に結び付けて書いてある', () => {
    render(<SignupForm />);
    expect(screen.getByLabelText('表示名')).toHaveAccessibleDescription(/仲間に見える名前/);
    expect(screen.getByLabelText('メールアドレス')).toHaveAccessibleDescription(/ログインに使います/);
  });
});

// A01-5: パスワードの表示切替
describe('パスワードの表示切替（A01-5）', () => {
  it.each([
    ['ログイン', <LoginForm key="l" />, 'パスワード'],
    ['新規登録', <SignupForm key="s" />, /パスワード（/],
  ])('%s: ボタンで表示と非表示を切り替えられる', async (_name, ui, label) => {
    const user = userEvent.setup();
    render(ui);
    const field = screen.getByLabelText(label);
    expect(field).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: '文字を表示' }));
    expect(field).toHaveAttribute('type', 'text');
    await user.click(screen.getByRole('button', { name: '文字を隠す' }));
    expect(field).toHaveAttribute('type', 'password');
  });
});

// A01-6・D1: 再設定機能は作らず、小さな「忘れたときは？」を開くと管理者への連絡を案内する
describe('パスワードを忘れたとき（A01-6・D1）', () => {
  it('「忘れたときは？」があり、開くと管理者へ連絡する案内が見える', async () => {
    const user = userEvent.setup();
    render(<LoginForm />);
    const note = screen.getByText('パスワードの再設定の機能はありません。グループの管理者に連絡してください');
    expect(note).not.toBeVisible();
    await user.click(screen.getByText('忘れたときは？'));
    expect(note).toBeVisible();
  });
});

// A01-7: 登録直後に完了を伝えてから移る
describe('登録完了の一言（A01-7）', () => {
  it('成功したら「登録できたよ」を出し、少し待ってから移る', async () => {
    signUpEmail.mockResolvedValue({ data: {}, error: null });
    const user = userEvent.setup();
    render(<SignupForm />);
    await user.type(screen.getByLabelText('表示名'), 'ゆうす');
    await user.type(screen.getByLabelText('メールアドレス'), 'a@example.com');
    await user.type(screen.getByLabelText(/パスワード（/), 'password123');
    await user.click(screen.getByRole('checkbox', { name: /同意/ }));
    await user.click(screen.getByRole('button', { name: '登録する' }));
    expect(await screen.findByRole('status')).toHaveTextContent('登録できたよ');
    expect(replace).not.toHaveBeenCalled();
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/today'), { timeout: 4000 });
  });
});
