import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import { NotificationBell } from '@/components/fitlog/notification-bell';
import { DEFAULT_PREFS, PREFS_KEY, savePrefs } from '@/lib/preferences';
import { NotificationsView } from './notifications-view';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => '/notifications' }));
vi.mock('@/lib/auth-client', () => ({
  authClient: { useSession: () => ({ data: { user: { id: 'u1', name: 'たろう' } }, isPending: false }) },
}));

const AVATAR = { body: 'A', hair: 1, hairColor: 'brown', shirtColor: 'coral', pantsColor: 'navy' };
const HANAKO = { id: 'u2', name: 'はなこ', avatar: AVATAR };
const item = (over: Record<string, unknown>) => ({
  id: 'stamp:1',
  kind: 'stamp',
  at: '2026-11-21T03:05:00.000Z',
  unread: true,
  actor: HANAKO,
  recordId: 'r1',
  recordKind: 'workout',
  stampKey: 'nice',
  ...over,
});

// 呼ばれた API の記録と、固定の応答を返す偽物の fetch
type Reply = { status: number; body?: unknown };
let list: Reply = { status: 200, body: { unreadCount: 0, items: [] } };
const calls: string[] = [];

beforeEach(() => {
  calls.length = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const key = `${init?.method ?? 'GET'} ${url}`;
      calls.push(key);
      if (key === 'GET /api/notifications') return new Response(JSON.stringify(list.body), { status: list.status, headers: { 'Content-Type': 'application/json' } });
      if (key === 'POST /api/notifications/seen') return new Response(null, { status: 204 });
      throw new Error(`想定外の呼び出し: ${key}`);
    }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.removeItem(PREFS_KEY);
  savePrefs(DEFAULT_PREFS);
  localStorage.removeItem(PREFS_KEY);
});

const renderWith = (ui: React.ReactElement) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
};

describe('NotificationsView（S-35 通知）', () => {
  it('設定でオフにした種類は一覧に出さない', async () => {
    savePrefs({ ...DEFAULT_PREFS, notify: { ...DEFAULT_PREFS.notify, comment: false } });
    list = { status: 200, body: { unreadCount: 2, items: [item({ id: 'comment:2', kind: 'comment', stampKey: null }), item({ id: 'friend_joined:4', kind: 'friend_joined', recordId: null, recordKind: null, stampKey: null })] } };
    renderWith(<NotificationsView />);
    expect(await screen.findByText('はなこさんが仲間に加わりました')).toBeInTheDocument();
    expect(screen.queryByText('はなこさんがコメントしました')).not.toBeInTheDocument();
  });

  it('新しい順に、文・時刻・未読の点・リンクを出し、読めたら「見た」を1回だけ送る', async () => {
    list = {
      status: 200,
      body: {
        unreadCount: 2,
        items: [
          item({ id: 'comment:2', kind: 'comment', stampKey: null }),
          item({ id: 'friend_record:3', kind: 'friend_record', unread: false, recordId: 'r3', stampKey: null, recordKind: 'run' }),
        ],
      },
    };
    renderWith(<NotificationsView />);
    const ul = await screen.findByRole('list', { name: '通知の一覧' });
    const [first, second] = within(ul).getAllByRole('link');
    expect(first).toHaveTextContent('はなこさんがコメントしました');
    expect(first).toHaveTextContent('11/21 12:05');
    expect(first).toHaveAttribute('href', '/record-detail?id=r1&from=me');
    expect(within(first).getByTestId('unread-dot')).toBeInTheDocument();
    expect(second).toHaveTextContent('はなこさんがランを記録しました');
    expect(second).toHaveAttribute('href', '/record-detail?id=r3');
    expect(within(second).queryByTestId('unread-dot')).not.toBeInTheDocument();
    await waitFor(() => expect(calls.filter((c) => c === 'POST /api/notifications/seen')).toHaveLength(1));
    // 見たあとも、この画面の未読の点は消えない（どれが新しかったか分かるように）
    expect(within(first).getByTestId('unread-dot')).toBeInTheDocument();
  });

  it('通知が無いときは、キャラの絵と一言だけ', async () => {
    list = { status: 200, body: { unreadCount: 0, items: [] } };
    renderWith(<NotificationsView />);
    expect(await screen.findByText('まだ おしらせは ありません')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: '通知の一覧' })).not.toBeInTheDocument();
  });

  it('読み込みに失敗したら、案内を出し、「見た」は送らない', async () => {
    list = { status: 500, body: { code: 'INTERNAL', message: 'x' } };
    renderWith(<NotificationsView />);
    expect(await screen.findByRole('alert')).toHaveTextContent('通知を読み込めませんでした');
    expect(calls).not.toContain('POST /api/notifications/seen');
  });
});

describe('NotificationBell（右上のベル）', () => {
  it('未読があれば数字と読み上げの名前を出す。0件なら数字は出さない', async () => {
    list = { status: 200, body: { unreadCount: 3, items: [item({ id: 'stamp:1' }), item({ id: 'stamp:2' }), item({ id: 'stamp:3' })] } };
    const { unmount } = renderWith(<NotificationBell />);
    const link = await screen.findByRole('link', { name: '通知（未読3件）' });
    expect(link).toHaveAttribute('href', '/notifications');
    expect(screen.getByTestId('notification-badge')).toHaveTextContent('3');
    unmount();

    list = { status: 200, body: { unreadCount: 0, items: [] } };
    renderWith(<NotificationBell />);
    expect(await screen.findByRole('link', { name: '通知' })).toBeInTheDocument();
    expect(screen.queryByTestId('notification-badge')).not.toBeInTheDocument();
  });

  it('10件以上は「9+」', async () => {
    list = { status: 200, body: { unreadCount: 12, items: Array.from({ length: 12 }, (_, i) => item({ id: `stamp:${i}` })) } };
    renderWith(<NotificationBell />);
    expect(await screen.findByTestId('notification-badge')).toHaveTextContent('9+');
  });

  it('設定でオフにした種類は数えない', async () => {
    savePrefs({ ...DEFAULT_PREFS, notify: { ...DEFAULT_PREFS.notify, stamp: false } });
    list = { status: 200, body: { unreadCount: 2, items: [item({ id: 'stamp:1' }), item({ id: 'comment:2', kind: 'comment', stampKey: null })] } };
    renderWith(<NotificationBell />);
    expect(await screen.findByRole('link', { name: '通知（未読1件）' })).toBeInTheDocument();
  });
});
