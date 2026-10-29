import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FriendsView } from './friends-view';

vi.mock('@/lib/auth-client', () => ({
  authClient: { useSession: () => ({ data: { user: { id: 'u1', name: 'たろう' } }, isPending: false }) },
}));

const AVATAR = { body: 'A', hair: 1, hairColor: 'brown', shirtColor: 'teal', pantsColor: 'navy' };
const GROUP = {
  id: 'g1',
  name: '朝トレ部',
  members: [
    { id: 'u1', name: 'たろう', avatar: AVATAR },
    { id: 'u2', name: 'はなこ', avatar: { ...AVATAR, shirtColor: 'coral' } },
  ],
};

// API の応答を、呼ばれた順に返す偽物の fetch。呼ばれ方（メソッド・パス・本文）を記録する
type Reply = { status: number; body?: unknown };
let replies: Record<string, Reply[]> = {};
const calls: { method: string; url: string; body?: unknown }[] = [];

const json = ({ status, body }: Reply) =>
  new Response(status === 204 ? null : JSON.stringify(body ?? {}), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

beforeEach(() => {
  replies = {};
  calls.length = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      calls.push({ method, url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
      const queue = replies[`${method} ${url}`];
      if (!queue?.length) throw new Error(`想定外の呼び出し: ${method} ${url}`);
      return json(queue.length > 1 ? queue.shift()! : queue[0]);
    }),
  );
});

afterEach(() => vi.unstubAllGlobals());

const renderView = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <FriendsView />
    </QueryClientProvider>,
  );
};

describe('FriendsView（S-20 仲間）', () => {
  describe('グループに入っていないとき', () => {
    it('「グループを作る」と「招待リンクで参加する」の2つだけを出す', async () => {
      replies['GET /api/groups/current'] = [{ status: 404, body: { code: 'GROUP_NOT_FOUND', message: 'グループに入っていません' } }];
      renderView();
      expect(await screen.findByRole('button', { name: 'グループを作る' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: '招待リンクで参加する' })).toBeInTheDocument();
      expect(screen.queryByText('メンバー')).not.toBeInTheDocument();
    });

    it('名前を入れて作ると POST /api/groups を送り、グループの表示に変わる', async () => {
      replies['GET /api/groups/current'] = [{ status: 404, body: {} }, { status: 200, body: GROUP }];
      replies['POST /api/groups'] = [{ status: 201, body: { id: 'g1', name: '朝トレ部' } }];
      const user = userEvent.setup();
      renderView();
      await user.click(await screen.findByRole('button', { name: 'グループを作る' }));
      await user.type(screen.getByLabelText('グループ名'), '  朝トレ部 ');
      await user.click(screen.getByRole('button', { name: '作る' }));

      expect(await screen.findByRole('heading', { name: '朝トレ部' })).toBeInTheDocument();
      // 前後の空白は取り除いて送る
      expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ name: '朝トレ部' });
    });

    // 境界値: 空・空白だけは送らずに知らせる（21字は入力欄の maxLength で打てない）
    it.each([['空', ''], ['空白だけ', '   ']])('名前が%sなら送らずに知らせる', async (_label, value) => {
      replies['GET /api/groups/current'] = [{ status: 404, body: {} }];
      const user = userEvent.setup();
      renderView();
      await user.click(await screen.findByRole('button', { name: 'グループを作る' }));
      if (value) await user.type(screen.getByLabelText('グループ名'), value);
      await user.click(screen.getByRole('button', { name: '作る' }));

      expect(await screen.findByRole('alert')).toHaveTextContent('グループ名は1〜20字で入れてください');
      expect(calls.some((c) => c.method === 'POST')).toBe(false);
    });

    it('入力欄は20字までしか入らない', async () => {
      replies['GET /api/groups/current'] = [{ status: 404, body: {} }];
      renderView();
      await userEvent.click(await screen.findByRole('button', { name: 'グループを作る' }));
      expect(screen.getByLabelText('グループ名')).toHaveAttribute('maxLength', '20');
    });

    it('すでにグループにいる（409）なら、API の文言を出す', async () => {
      replies['GET /api/groups/current'] = [{ status: 404, body: {} }];
      replies['POST /api/groups'] = [{ status: 409, body: { code: 'ALREADY_IN_GROUP', message: 'すでにグループに入っています', details: null } }];
      const user = userEvent.setup();
      renderView();
      await user.click(await screen.findByRole('button', { name: 'グループを作る' }));
      await user.type(screen.getByLabelText('グループ名'), '二つ目');
      await user.click(screen.getByRole('button', { name: '作る' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('すでにグループに入っています');
    });
  });

  describe('グループに入っているとき', () => {
    it('人数・グループ名・メンバーを出し、自分には「あなた」を付ける', async () => {
      replies['GET /api/groups/current'] = [{ status: 200, body: GROUP }];
      renderView();
      expect(await screen.findByRole('heading', { name: '朝トレ部' })).toBeInTheDocument();
      const items = screen.getAllByRole('listitem');
      expect(items).toHaveLength(2);
      expect(items[0]).toHaveTextContent('たろう');
      expect(items[0]).toHaveTextContent('あなた');
      expect(items[1]).toHaveTextContent('はなこ');
      expect(items[1]).not.toHaveTextContent('あなた');
    });

    it('5人なら招待リンクを作れず、満員と出す', async () => {
      const members = Array.from({ length: 5 }, (_, i) => ({ id: `u${i + 1}`, name: `人${i + 1}`, avatar: AVATAR }));
      replies['GET /api/groups/current'] = [{ status: 200, body: { ...GROUP, members } }];
      renderView();
      expect(await screen.findByText('満員です（5人まで）')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: '招待リンクを作る' })).not.toBeInTheDocument();
    });

    it('招待リンクを作るとリンクと期限を出し、取り消すと DELETE を送って消える', async () => {
      replies['GET /api/groups/current'] = [{ status: 200, body: GROUP }];
      replies['POST /api/groups/current/invitations'] = [
        { status: 201, body: { id: 'inv-1', token: 'abc_DEF-123', expiresAt: '2026-11-06T03:00:00.000Z' } },
      ];
      replies['DELETE /api/groups/current/invitations/inv-1'] = [{ status: 204 }];
      const user = userEvent.setup();
      renderView();
      await user.click(await screen.findByRole('button', { name: '招待リンクを作る' }));

      const link = await screen.findByLabelText('招待リンク');
      expect(link).toHaveValue(`${window.location.origin}/invite?token=abc_DEF-123`);
      // 期限は日本時間で出す（UTC 03:00 → 日本時間 12:00）
      expect(screen.getByText(/11\/6 12:00 まで使えます/)).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: '取り消す' }));
      expect(await screen.findByText('リンクを取り消しました。もう使えません')).toBeInTheDocument();
      expect(screen.queryByLabelText('招待リンク')).not.toBeInTheDocument();
      expect(calls.some((c) => c.method === 'DELETE' && c.url.endsWith('/invitations/inv-1'))).toBe(true);
    });

    it('コピーを押すと、リンクをクリップボードへ書き、「コピーしました」に変わる', async () => {
      replies['GET /api/groups/current'] = [{ status: 200, body: GROUP }];
      replies['POST /api/groups/current/invitations'] = [
        { status: 201, body: { id: 'inv-1', token: 'tok', expiresAt: '2026-11-06T03:00:00.000Z' } },
      ];
      const user = userEvent.setup();
      const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
      renderView();
      await user.click(await screen.findByRole('button', { name: '招待リンクを作る' }));
      await user.click(await screen.findByRole('button', { name: 'コピー' }));

      await waitFor(() => expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/invite?token=tok`));
      expect(screen.getByRole('button', { name: 'コピーしました' })).toBeInTheDocument();
    });
  });

  it('グループを出る: 確かめてから DELETE を送り、グループなしの表示に戻る。「やめる」なら送らない', async () => {
    replies['GET /api/groups/current'] = [{ status: 200, body: GROUP }, { status: 404, body: {} }];
    replies['DELETE /api/groups/current/members/me'] = [{ status: 204 }];
    const user = userEvent.setup();
    renderView();
    await user.click(await screen.findByRole('button', { name: 'グループを出る' }));
    await user.click(screen.getByRole('button', { name: 'やめる' }));
    expect(calls.some((c) => c.method === 'DELETE')).toBe(false);

    await user.click(screen.getByRole('button', { name: 'グループを出る' }));
    await user.click(screen.getByRole('button', { name: '出る' }));
    expect(await screen.findByRole('button', { name: 'グループを作る' })).toBeInTheDocument();
    expect(calls.filter((c) => c.method === 'DELETE').map((c) => c.url)).toEqual(['/api/groups/current/members/me']);
  });

  it('読み込みが通信で失敗したら、責めない文言で知らせる', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))));
    renderView();
    expect(await screen.findByRole('alert')).toHaveTextContent('読み込めませんでした');
  });
});
