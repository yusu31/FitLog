import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FORBIDDEN_WORDS } from '@/lib/forbidden-words';
import { GroupSettingsView } from './group-settings-view';

const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }), usePathname: () => '/settings/group/' }));
let session: { data: unknown; isPending: boolean } = { data: { user: { id: 'u1', name: 'たろう' } }, isPending: false };
vi.mock('@/lib/auth-client', () => ({ authClient: { useSession: () => session } }));

const AVATAR = { body: 'A', hair: 1, hairColor: 'brown', shirtColor: 'teal', pantsColor: 'navy' };
const GROUP = {
  id: 'g1',
  name: '朝トレ部',
  members: [
    { id: 'u1', name: 'たろう', avatar: AVATAR },
    { id: 'u2', name: 'はなこ', avatar: { ...AVATAR, shirtColor: 'coral' } },
  ],
};
const NOT_IN_GROUP = { status: 404, body: { code: 'GROUP_NOT_FOUND', message: 'グループに入っていません' } };

type Reply = { status: number; body?: unknown };
let replies: Record<string, Reply[]> = {};
const calls: { method: string; url: string; body?: unknown }[] = [];

beforeEach(() => {
  replies = {};
  calls.length = 0;
  replace.mockClear();
  session = { data: { user: { id: 'u1', name: 'たろう' } }, isPending: false };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      calls.push({ method, url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
      const queue = replies[`${method} ${url}`];
      if (!queue?.length) throw new Error(`想定外の呼び出し: ${method} ${url}`);
      const { status, body } = queue.length > 1 ? queue.shift()! : queue[0];
      return new Response(status === 204 ? null : JSON.stringify(body ?? {}), { status, headers: { 'Content-Type': 'application/json' } });
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

const renderView = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <GroupSettingsView />
    </QueryClientProvider>,
  );
};

describe('GroupSettingsView（S-32 グループの設定）', () => {
  it('見出しと、設定へ戻るリンクを出す', async () => {
    replies['GET /api/groups/current'] = [{ status: 200, body: GROUP }];
    renderView();
    expect(screen.getByRole('heading', { level: 1, name: 'グループの設定' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '設定へ戻る' })).toHaveAttribute('href', '/settings');
    await screen.findByRole('heading', { name: '朝トレ部' });
  });

  it('ログインしていなければ、戻り先つきでログイン画面へ移し、グループは取りにいかない', () => {
    session = { data: null, isPending: false };
    renderView();
    expect(replace).toHaveBeenCalledWith('/login?next=%2Fsettings%2Fgroup%2F');
    expect(calls).toHaveLength(0);
  });

  describe('グループに入っていないとき', () => {
    beforeEach(() => {
      replies['GET /api/groups/current'] = [NOT_IN_GROUP];
    });

    it('グループを作るフォームを、すぐ使える形で出す（メンバー・招待・出るは出さない）', async () => {
      renderView();
      expect(await screen.findByLabelText('グループ名')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '作る' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: '招待リンクを作る' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'グループを出る' })).not.toBeInTheDocument();
    });

    it('名前を入れて作ると、前後の空白を除いて POST を送り、招待リンクを作る案内つきでグループの表示に変わる', async () => {
      replies['GET /api/groups/current'] = [NOT_IN_GROUP, { status: 200, body: GROUP }];
      replies['POST /api/groups'] = [{ status: 201, body: { id: 'g1', name: '朝トレ部' } }];
      const user = userEvent.setup();
      renderView();
      await user.type(await screen.findByLabelText('グループ名'), '  朝トレ部 ');
      await user.click(screen.getByRole('button', { name: '作る' }));

      expect(await screen.findByRole('heading', { name: '朝トレ部' })).toBeInTheDocument();
      expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ name: '朝トレ部' });
      expect(screen.getByRole('status')).toHaveTextContent('グループを作りました。つぎは、招待リンクを作って仲間に送ろう');
      expect(screen.getByRole('button', { name: '招待リンクを作る' })).toBeInTheDocument();
    });

    // T-NAME-01 境界値: 0字・1字・20字は画面側の判断（0 は送らない／1・20 は送る）。21字は入力欄の maxLength で打てない上、
    // 貼り付けなどで入っても送らない
    it.each([
      ['0字（空）', '', false],
      ['0字（空白だけ）', '   ', false],
      ['1字', 'あ', true],
      ['20字', 'あ'.repeat(20), true],
      ['21字', 'あ'.repeat(21), false],
    ])('名前が%sなら、送る=%s', async (_label, value, sent) => {
      replies['POST /api/groups'] = [{ status: 201, body: { id: 'g1', name: value.trim() } }];
      replies['GET /api/groups/current'] = [NOT_IN_GROUP, { status: 200, body: { ...GROUP, name: value.trim() || GROUP.name } }];
      const user = userEvent.setup();
      renderView();
      const input = await screen.findByLabelText('グループ名');
      // fireEvent は maxLength を通り抜ける（貼り付けや自動入力を想定）
      fireEvent.change(input, { target: { value } });
      await user.click(screen.getByRole('button', { name: '作る' }));

      if (sent) {
        await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
        expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ name: value.trim() });
      } else {
        expect(await screen.findByRole('alert')).toHaveTextContent('グループ名は1〜20字で入れてください');
        expect(calls.some((c) => c.method === 'POST')).toBe(false);
      }
    });

    it('入力欄は20字までしか入らない', async () => {
      renderView();
      expect(await screen.findByLabelText('グループ名')).toHaveAttribute('maxLength', '20');
    });

    it('すでにグループにいる（409 ALREADY_IN_GROUP）なら、決めた文言を出す', async () => {
      replies['POST /api/groups'] = [{ status: 409, body: { code: 'ALREADY_IN_GROUP', message: 'API の英語まじりの文言', details: null } }];
      const user = userEvent.setup();
      renderView();
      await user.type(await screen.findByLabelText('グループ名'), '二つ目');
      await user.click(screen.getByRole('button', { name: '作る' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('すでにグループに入っています。1人が入れるグループは1つです');
    });

    it('通信が切れたら、責めない文言で知らせる', async () => {
      const user = userEvent.setup();
      renderView();
      await user.type(await screen.findByLabelText('グループ名'), '朝トレ部');
      // POST だけ想定外の呼び出しで例外になる（通信エラー相当）
      await user.click(screen.getByRole('button', { name: '作る' }));
      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent('通信できませんでした');
    });
  });

  describe('グループに入っているとき', () => {
    beforeEach(() => {
      replies['GET /api/groups/current'] = [{ status: 200, body: GROUP }];
    });

    it('グループ名・人数（今の人数／5人まで）・メンバーを出し、自分には「あなた」を付ける', async () => {
      renderView();
      expect(await screen.findByRole('heading', { name: '朝トレ部' })).toBeInTheDocument();
      expect(screen.getByText('／ 5人まで')).toBeInTheDocument();
      expect(screen.getByLabelText('いまの人数')).toHaveTextContent('2');
      const items = within(screen.getByRole('list', { name: 'メンバー' })).getAllByRole('listitem');
      expect(items).toHaveLength(2);
      expect(items[0]).toHaveTextContent('たろう');
      expect(items[0]).toHaveTextContent('あなた');
      expect(items[1]).toHaveTextContent('はなこ');
      expect(items[1]).not.toHaveTextContent('あなた');
    });

    it('4人なら招待リンクを作れる（5人目の枠が残っている）', async () => {
      const members = Array.from({ length: 4 }, (_, i) => ({ id: `u${i + 1}`, name: `人${i + 1}`, avatar: AVATAR }));
      replies['GET /api/groups/current'] = [{ status: 200, body: { ...GROUP, members } }];
      renderView();
      expect(await screen.findByRole('button', { name: '招待リンクを作る' })).toBeInTheDocument();
      expect(screen.queryByText(/満員です/)).not.toBeInTheDocument();
    });

    it('5人なら招待リンクを作れず、満員と出す', async () => {
      const members = Array.from({ length: 5 }, (_, i) => ({ id: `u${i + 1}`, name: `人${i + 1}`, avatar: AVATAR }));
      replies['GET /api/groups/current'] = [{ status: 200, body: { ...GROUP, members } }];
      renderView();
      expect(await screen.findByText('満員です（5人まで）')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: '招待リンクを作る' })).not.toBeInTheDocument();
    });

    it('招待リンクを作るとリンクと期限を出し、取り消すと DELETE を送って消える', async () => {
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

    it('コピーできなかったら、長押しで選ぶ案内を出す', async () => {
      replies['POST /api/groups/current/invitations'] = [
        { status: 201, body: { id: 'inv-1', token: 'tok', expiresAt: '2026-11-06T03:00:00.000Z' } },
      ];
      const user = userEvent.setup();
      vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('denied'));
      renderView();
      await user.click(await screen.findByRole('button', { name: '招待リンクを作る' }));
      await user.click(await screen.findByRole('button', { name: 'コピー' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('リンクを長押しして選んでください');
    });

    it('招待リンクを作るとき満員（409 GROUP_FULL）と返ったら、決めた文言を出す', async () => {
      replies['POST /api/groups/current/invitations'] = [{ status: 409, body: { code: 'GROUP_FULL', message: 'API の文言', details: null } }];
      const user = userEvent.setup();
      renderView();
      await user.click(await screen.findByRole('button', { name: '招待リンクを作る' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('このグループは満員です（5人まで）');
    });

    it('取り消せなかったとき（404 INVITATION_NOT_FOUND）も、リンクは残して文言を出す', async () => {
      replies['POST /api/groups/current/invitations'] = [
        { status: 201, body: { id: 'inv-1', token: 'tok', expiresAt: '2026-11-06T03:00:00.000Z' } },
      ];
      replies['DELETE /api/groups/current/invitations/inv-1'] = [{ status: 404, body: { code: 'INVITATION_NOT_FOUND', message: 'x', details: null } }];
      const user = userEvent.setup();
      renderView();
      await user.click(await screen.findByRole('button', { name: '招待リンクを作る' }));
      await user.click(await screen.findByRole('button', { name: '取り消す' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('招待が見つかりません');
      expect(screen.getByLabelText('招待リンク')).toBeInTheDocument();
    });

    describe('グループを出る', () => {
      it('ボタンを押すと確認のダイアログを出し、「やめる」なら DELETE を送らない', async () => {
        const user = userEvent.setup();
        renderView();
        await user.click(await screen.findByRole('button', { name: 'グループを出る' }));
        const dialog = screen.getByRole('alertdialog', { name: 'グループを出ますか？' });
        expect(dialog).toHaveTextContent('もう一度入るには、新しい招待リンクが必要');
        await user.click(within(dialog).getByRole('button', { name: 'やめる' }));
        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
        expect(calls.some((c) => c.method === 'DELETE')).toBe(false);
      });

      it('「出る」を押すと DELETE を送り、グループなしの表示（作るフォーム）に戻る', async () => {
        replies['GET /api/groups/current'] = [{ status: 200, body: GROUP }, NOT_IN_GROUP];
        replies['DELETE /api/groups/current/members/me'] = [{ status: 204 }];
        const user = userEvent.setup();
        renderView();
        await user.click(await screen.findByRole('button', { name: 'グループを出る' }));
        await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: '出る' }));

        expect(await screen.findByLabelText('グループ名')).toBeInTheDocument();
        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
        expect(calls.filter((c) => c.method === 'DELETE').map((c) => c.url)).toEqual(['/api/groups/current/members/me']);
      });

      it('出られなかったら（5xx）、ダイアログは閉じて、内部の事情ではなく決めた文言を出す', async () => {
        replies['DELETE /api/groups/current/members/me'] = [{ status: 500, body: { code: 'INTERNAL', message: 'DB connection refused', details: null } }];
        const user = userEvent.setup();
        renderView();
        await user.click(await screen.findByRole('button', { name: 'グループを出る' }));
        await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: '出る' }));
        const alert = await screen.findByRole('alert');
        expect(alert).toHaveTextContent('グループを出られませんでした');
        expect(alert).not.toHaveTextContent('DB connection');
        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      });
    });
  });

  it('読み込みが通信で止まったら、責めない文言で知らせる', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))));
    renderView();
    expect(await screen.findByRole('alert')).toHaveTextContent('読み込めませんでした');
  });

  it('画面の文言に、使ってはいけない語を含まない', async () => {
    replies['GET /api/groups/current'] = [{ status: 200, body: GROUP }];
    const user = userEvent.setup();
    renderView();
    await user.click(await screen.findByRole('button', { name: 'グループを出る' }));
    const text = document.body.textContent ?? '';
    for (const word of FORBIDDEN_WORDS) expect(text).not.toContain(word);
  });
});
