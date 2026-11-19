import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InviteView } from './invite-view';

const replace = vi.fn();
const push = vi.fn();
let search = 'token=tok_123';
let session: { data: unknown; isPending: boolean } = { data: null, isPending: false };
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push }),
  useSearchParams: () => new URLSearchParams(search),
}));
vi.mock('@/lib/auth-client', () => ({ authClient: { useSession: () => session } }));

type Reply = { status: number; body?: unknown };
let replies: Record<string, Reply> = {};
const calls: string[] = [];

beforeEach(() => {
  replace.mockReset();
  push.mockReset();
  search = 'token=tok_123';
  session = { data: null, isPending: false };
  replies = {};
  calls.length = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const key = `${init?.method ?? 'GET'} ${url}`;
      calls.push(key);
      const r = replies[key];
      if (!r) throw new Error(`想定外の呼び出し: ${key}`);
      return new Response(JSON.stringify(r.body ?? {}), { status: r.status, headers: { 'Content-Type': 'application/json' } });
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

const renderView = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <InviteView />
    </QueryClientProvider>,
  );

const OK = { status: 200, body: { groupName: '朝トレ部', memberCount: 3, memberMax: 5 } };

describe('InviteView（S-03 招待を受ける）', () => {
  it('ログインしていなくても、グループ名と人数を出し、登録・ログインの入口に戻り先を付ける', async () => {
    replies['GET /api/invitations/tok_123'] = OK;
    renderView();
    expect(await screen.findByRole('heading', { name: '朝トレ部' })).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    const next = encodeURIComponent('/invite?token=tok_123');
    expect(screen.getByRole('link', { name: '登録して参加' })).toHaveAttribute('href', `/signup?next=${next}`);
    expect(screen.getByRole('link', { name: 'ログインして参加' })).toHaveAttribute('href', `/login?next=${next}`);
    expect(screen.queryByRole('button', { name: '参加する' })).not.toBeInTheDocument();
  });

  it('ログイン済みなら「参加する」で POST し、成功したら仲間タブへ移る', async () => {
    session = { data: { user: { id: 'u2', name: 'はなこ' } }, isPending: false };
    replies['GET /api/invitations/tok_123'] = OK;
    replies['POST /api/invitations/tok_123/accept'] = { status: 200, body: { id: 'g1', name: '朝トレ部' } };
    renderView();
    await userEvent.click(await screen.findByRole('button', { name: '参加する' }));
    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith('/friends'));
    expect(calls).toContain('POST /api/invitations/tok_123/accept');
  });

  it.each([
    ['すでにグループにいる', { code: 'ALREADY_IN_GROUP', message: 'すでにグループに入っています' }],
    ['満員（同時に参加された）', { code: 'GROUP_FULL', message: 'このグループは満員です' }],
  ])('参加が 409（%s）なら、API の文言を出して移らない', async (_label, body) => {
    session = { data: { user: { id: 'u2', name: 'はなこ' } }, isPending: false };
    replies['GET /api/invitations/tok_123'] = OK;
    replies['POST /api/invitations/tok_123/accept'] = { status: 409, body };
    renderView();
    await userEvent.click(await screen.findByRole('button', { name: '参加する' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(body.message);
    expect(replace).not.toHaveBeenCalled();
  });

  // T-PEER-07（N11）: 「登録して参加」「ログインして参加」を押して戻ってきたときだけ、自動で参加する
  describe('登録・ログインから戻ったとき', () => {
    const intentKey = 'fitlog:join-intent';
    beforeEach(() => sessionStorage.clear());
    const signedIn = () => {
      session = { data: { user: { id: 'u2', name: 'はなこ' } }, isPending: false };
      replies['GET /api/invitations/tok_123'] = OK;
      replies['POST /api/invitations/tok_123/accept'] = { status: 200, body: { id: 'g1', name: '朝トレ部' } };
    };

    it('「登録して参加」を押すと、この token で参加するつもりだと端末に控える', async () => {
      replies['GET /api/invitations/tok_123'] = OK;
      renderView();
      await userEvent.click(await screen.findByRole('link', { name: '登録して参加' }));
      expect(sessionStorage.getItem(intentKey)).toBe('tok_123');
    });

    it('控えがあるログイン済みの戻りなら、「参加する」を押さなくても参加して仲間タブへ移る', async () => {
      signedIn();
      sessionStorage.setItem(intentKey, 'tok_123');
      renderView();
      await vi.waitFor(() => expect(replace).toHaveBeenCalledWith('/friends'));
      expect(calls.filter((c) => c === 'POST /api/invitations/tok_123/accept')).toHaveLength(1);
      expect(sessionStorage.getItem(intentKey)).toBeNull();
    });

    it('控えが無いなら（リンクを開いただけ）、勝手に参加せず「参加する」を待つ', async () => {
      signedIn();
      renderView();
      expect(await screen.findByRole('button', { name: '参加する' })).toBeInTheDocument();
      expect(calls).not.toContain('POST /api/invitations/tok_123/accept');
    });

    it('別の token の控えでは参加しない', async () => {
      signedIn();
      sessionStorage.setItem(intentKey, 'other_token');
      renderView();
      expect(await screen.findByRole('button', { name: '参加する' })).toBeInTheDocument();
      expect(calls).not.toContain('POST /api/invitations/tok_123/accept');
    });

    it('自動参加が失敗したら、文言を出して「参加する」ボタンを残す（控えは使い切る）', async () => {
      signedIn();
      replies['POST /api/invitations/tok_123/accept'] = { status: 409, body: { code: 'GROUP_FULL', message: '満員' } };
      sessionStorage.setItem(intentKey, 'tok_123');
      renderView();
      expect(await screen.findByRole('alert')).toHaveTextContent('満員');
      expect(screen.getByRole('button', { name: '参加する' })).toBeInTheDocument();
      expect(replace).not.toHaveBeenCalled();
      expect(sessionStorage.getItem(intentKey)).toBeNull();
    });
  });

  it('満員（5人）なら、参加の入口を出さずに知らせる', async () => {
    replies['GET /api/invitations/tok_123'] = { status: 200, body: { groupName: '朝トレ部', memberCount: 5, memberMax: 5 } };
    renderView();
    expect(await screen.findByRole('status')).toHaveTextContent('このグループは満員です');
    expect(screen.queryByRole('link', { name: '登録して参加' })).not.toBeInTheDocument();
  });

  it.each([
    [410, '期限が切れています'],
    [404, 'このリンクは使えません'],
  ])('閲覧が %i なら「%s」と出す', async (status, title) => {
    replies['GET /api/invitations/tok_123'] = { status, body: {} };
    renderView();
    expect(await screen.findByRole('heading', { name: title })).toBeInTheDocument();
  });

  it('リンクに token が無ければ、API を呼ばずに知らせる', async () => {
    search = '';
    renderView();
    expect(screen.getByRole('heading', { name: 'リンクが正しくありません' })).toBeInTheDocument();
    expect(calls).toEqual([]);
  });

  // A13-8: 使えないリンクのとき、貼り直す入力欄を出す（未ログイン・ログイン済みとも）
  describe('使えないリンクのとき', () => {
    it.each([
      ['未ログイン', null],
      ['ログイン済み', { user: { id: 'u2', name: 'はなこ' } }],
    ])('%s でも、リンクを貼り直す欄を出し、貼ると新しい参加の画面へ移る', async (_label, data) => {
      session = { data, isPending: false };
      replies['GET /api/invitations/tok_123'] = { status: 404, body: { code: 'INVITATION_NOT_FOUND', message: 'x' } };
      const user = userEvent.setup();
      renderView();
      expect(await screen.findByRole('heading', { name: 'このリンクは使えません' })).toBeInTheDocument();
      await user.type(screen.getByLabelText('届いた招待リンク'), 'https://fitlog.example/invite?token=new_TOKEN-1');
      await user.click(screen.getByRole('button', { name: '開く' }));
      expect(push).toHaveBeenCalledWith('/invite?token=new_TOKEN-1');
    });

    it('読み取れない文字列を貼ったら、移らずに案内を出す', async () => {
      replies['GET /api/invitations/tok_123'] = { status: 404, body: {} };
      const user = userEvent.setup();
      renderView();
      await screen.findByRole('heading', { name: 'このリンクは使えません' });
      await user.type(screen.getByLabelText('届いた招待リンク'), 'こんにちは');
      await user.click(screen.getByRole('button', { name: '開く' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('招待リンクが読み取れませんでした');
      expect(push).not.toHaveBeenCalled();
    });

    it('期限切れのときも貼り直せる。「仲間タブへ」は 24px 以上の的（min-h を持つ）', async () => {
      replies['GET /api/invitations/tok_123'] = { status: 410, body: {} };
      renderView();
      await screen.findByRole('heading', { name: '期限が切れています' });
      expect(screen.getByLabelText('届いた招待リンク')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: '仲間タブへ' }).className).toMatch(/min-h-11/);
    });
  });
});
