import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FORBIDDEN_WORDS } from '@/lib/forbidden-words';
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
  describe('グループに入っていないとき（案内の部品）', () => {
    beforeEach(() => {
      replies['GET /api/groups/current'] = [{ status: 404, body: { code: 'GROUP_NOT_FOUND', message: 'グループに入っていません' } }];
    });

    it('「グループを作る」と「招待リンクで参加する」の2つだけを出す', async () => {
      renderView();
      expect(await screen.findByRole('button', { name: 'グループを作る' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: '招待リンクで参加する' })).toBeInTheDocument();
      expect(screen.queryByText('メンバー')).not.toBeInTheDocument();
    });

    it('順位・連続日数・足跡は出さない（責めない・見せ合うだけ）', async () => {
      renderView();
      await screen.findByRole('button', { name: 'グループを作る' });
      const text = document.body.textContent ?? '';
      for (const word of ['順位', '連続', ...FORBIDDEN_WORDS]) expect(text).not.toContain(word);
    });

    it('「グループを作る」を押すと、この画面の中に名前の入力欄を開く（作る入口は仲間タブ）', async () => {
      const user = userEvent.setup();
      renderView();
      await user.click(await screen.findByRole('button', { name: 'グループを作る' }));
      expect(screen.getByLabelText('グループ名')).toBeInTheDocument();
      // やめると閉じる
      await user.click(screen.getByRole('button', { name: 'やめる' }));
      expect(screen.queryByLabelText('グループ名')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'グループを作る' })).toBeInTheDocument();
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

    // T-NAME-01 境界値: 0字（空・空白）と21字は送らず知らせる
    it.each([
      ['空', ''],
      ['空白だけ', '   '],
      ['21字', 'あ'.repeat(21)],
    ])('名前が%sなら送らずに知らせる', async (_label, value) => {
      const user = userEvent.setup();
      renderView();
      await user.click(await screen.findByRole('button', { name: 'グループを作る' }));
      fireEvent.change(screen.getByLabelText('グループ名'), { target: { value } });
      await user.click(screen.getByRole('button', { name: '作る' }));

      expect(await screen.findByRole('alert')).toHaveTextContent('グループ名は1〜20字で入れてください');
      expect(calls.some((c) => c.method === 'POST')).toBe(false);
    });

    it('すでにグループにいる（409 ALREADY_IN_GROUP）なら、決めた文言を出す', async () => {
      replies['POST /api/groups'] = [{ status: 409, body: { code: 'ALREADY_IN_GROUP', message: 'すでにグループに入っています', details: null } }];
      const user = userEvent.setup();
      renderView();
      await user.click(await screen.findByRole('button', { name: 'グループを作る' }));
      await user.type(screen.getByLabelText('グループ名'), '二つ目');
      await user.click(screen.getByRole('button', { name: '作る' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('1人が入れるグループは1つです');
    });
  });

  describe('グループに入っているとき', () => {
    beforeEach(() => {
      replies['GET /api/groups/current'] = [{ status: 200, body: GROUP }];
    });

    it('人数・グループ名・メンバーを出し、自分には「あなた」を付ける', async () => {
      renderView();
      expect(await screen.findByRole('heading', { name: '朝トレ部' })).toBeInTheDocument();
      const items = within(screen.getByRole('list', { name: 'メンバー' })).getAllByRole('listitem');
      expect(items).toHaveLength(2);
      expect(items[0]).toHaveTextContent('たろう');
      expect(items[0]).toHaveTextContent('あなた');
      expect(items[1]).toHaveTextContent('はなこ');
      expect(items[1]).not.toHaveTextContent('あなた');
    });

    it('招待・グループを出るは S-32 に移したので、ここには置かず、設定へのリンクだけ置く', async () => {
      renderView();
      await screen.findByRole('heading', { name: '朝トレ部' });
      expect(screen.queryByRole('button', { name: '招待リンクを作る' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'グループを出る' })).not.toBeInTheDocument();
      expect(screen.getByRole('link', { name: /グループの設定/ })).toHaveAttribute('href', '/settings/group');
    });
  });

  it('読み込みが通信で失敗したら、責めない文言で知らせる', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))));
    renderView();
    expect(await screen.findByRole('alert')).toHaveTextContent('読み込めませんでした');
  });
});
