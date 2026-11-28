import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { weekOf } from '@/lib/test/fake-api';
import { toLocalDate } from '@/lib/shared/local-date';
import { HomeView } from './home-view';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

// ホーム（02-9 ⑫）: 自分のキャラと今日の1行・仲間のタイムライン（畳める）・ベル（見出しの行）
const AVATAR = { body: 'A', hair: 1, hairColor: 'brown', shirtColor: 'teal', pantsColor: 'navy' };
const GROUP = {
  id: 'g1',
  name: '朝トレ部',
  members: [
    { id: 'u1', name: 'たろう', avatar: AVATAR },
    { id: 'u2', name: 'はなこ', avatar: AVATAR },
  ],
};
const today = toLocalDate(new Date());
const VIDEO = { id: 'v1', recordId: 'r1', recordedAt: '2026-11-18T01:00:00.000Z', visibleUntil: '2026-11-22T15:00:00.000Z', mine: false, author: { id: 'u2', name: 'はなこ', avatar: AVATAR } };

type Reply = { status: number; body?: unknown };
let routes: Record<string, Reply> = {};
const calls: string[] = [];

beforeEach(() => {
  calls.length = 0;
  routes = {
    '/api/week': { status: 200, body: weekOf(today) },
    '/api/groups/current': { status: 200, body: GROUP },
    '/api/notifications': { status: 200, body: { items: [] } },
    '/api/avatar': { status: 404, body: { code: 'NOT_FOUND', message: 'x', details: null } },
    '/api/videos/week': { status: 200, body: { weekStart: '2026-11-16', unlocked: false, items: [VIDEO] } },
    '/api/feed': { status: 200, body: { items: [], nextCursor: null, totals: { activeDays: 0, restDays: 0, totalWeightKg: 0, runDistanceM: 0 } } },
  };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const path = url.split('?')[0];
      calls.push(path);
      const r = routes[path];
      if (!r) throw new Error(`想定外の呼び出し: ${url}`);
      return new Response(JSON.stringify(r.body ?? {}), { status: r.status, headers: { 'Content-Type': 'application/json' } });
    }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

const renderView = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <HomeView />
    </QueryClientProvider>,
  );
};

describe('HomeView（ホーム）', () => {
  it('見出し「ホーム」と同じ行に、通知のベルがある', async () => {
    renderView();
    const h1 = screen.getByRole('heading', { level: 1, name: 'ホーム' });
    expect(h1.parentElement).toContainElement(screen.getByRole('link', { name: '通知' }));
    await screen.findByText('今日の 1セットから はじめよう');
  });

  it('今日の1行は、今日の状態で変わる（記録した日・おやすみ・まだ）。記録タブへの入口がある', async () => {
    routes['/api/week'] = { status: 200, body: weekOf(today, { [today]: 'rec' }) };
    const first = renderView();
    expect(await screen.findByText('今日は記録できたよ。おつかれさま')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '記録を開く' })).toHaveAttribute('href', '/log');
    first.unmount();
    routes['/api/week'] = { status: 200, body: weekOf(today, { [today]: 'rest' }) };
    renderView();
    expect(await screen.findByText('今日はおやすみ。ゆっくり休もう')).toBeInTheDocument();
  });

  it('仲間のタイムラインは畳める（<details>）。仲間がいれば今週の2秒動画の列も出る', async () => {
    renderView();
    const summary = screen.getByText('仲間のタイムライン');
    expect(summary.closest('details')).toHaveAttribute('open');
    expect(await screen.findByRole('heading', { name: '今週の2秒動画' })).toBeInTheDocument();
  });

  it('仲間がいれば、タイムラインの一番上に「今日の記録」の帯が出る（記録した人の顔だけ）', async () => {
    routes['/api/groups/current'] = {
      status: 200,
      body: { ...GROUP, members: [{ ...GROUP.members[0], today: 'workout' }, { ...GROUP.members[1], today: 'none' }] },
    };
    renderView();
    const band = await screen.findByTestId('today-band');
    expect(band).toHaveAttribute('data-complete', 'false');
    expect(screen.getAllByTestId('today-band-face')).toHaveLength(1);
    // 帯は、2秒動画の列より上（タイムラインの一番上）
    const strip = await screen.findByRole('heading', { name: '今週の2秒動画' });
    expect(band.compareDocumentPosition(strip) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('グループの出来事（加わった・ミッションを変えた）が、今日の帯と2秒動画の列のあいだに出る', async () => {
    routes['/api/groups/current'] = {
      status: 200,
      body: { ...GROUP, events: [{ kind: 'joined', at: '2026-11-26T03:00:00.000Z', actorId: 'u2', actorName: 'はなこ' }] },
    };
    renderView();
    expect(await screen.findByText('はなこさんが仲間に加わりました')).toBeInTheDocument();
  });

  it('グループが無いときは、足跡を読みに行かず、仲間タブへ案内する', async () => {
    routes['/api/groups/current'] = { status: 404, body: { code: 'NOT_FOUND', message: 'x', details: null } };
    renderView();
    expect(await screen.findByRole('link', { name: '仲間を探す' })).toHaveAttribute('href', '/friends');
    expect(calls).not.toContain('/api/feed');
  });
});

// 02-9 ⑭: 講師・転職先に見せるための「デモ仲間 有り／無し」。既定は無し。有りにすると見本の4人（見本の札つき）が入り、API は呼ばない
describe('デモ仲間の切替（⑭）', () => {
  it('既定は無し。ボタンで有りにすると見本の4人が出て、無しに戻すと消える。端末に覚える', async () => {
    const user = userEvent.setup();
    renderView();
    const toggle = await screen.findByRole('button', { name: 'デモ仲間 無し' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByTestId('demo-friends')).not.toBeInTheDocument();

    await user.click(toggle);
    const demo = await screen.findByTestId('demo-friends');
    const cards = within(demo).getAllByRole('listitem').filter((li) => within(li).queryByText('見本', { selector: 'span' }));
    expect(cards).toHaveLength(4);
    expect(screen.getByRole('button', { name: 'デモ仲間 有り' })).toHaveAttribute('aria-pressed', 'true');
    expect(localStorage.getItem('fitlog.demoFriends')).toBe('1');
    // 見本は触れない（スタンプのボタン・コメント・詳細へのリンクを置かない）。順位・連続日数の言葉も出さない
    expect(within(demo).queryByRole('button')).not.toBeInTheDocument();
    expect(within(demo).queryByRole('link')).not.toBeInTheDocument();
    expect(demo).not.toHaveTextContent(/順位|連続|位/);

    await user.click(screen.getByRole('button', { name: 'デモ仲間 有り' }));
    expect(screen.queryByTestId('demo-friends')).not.toBeInTheDocument();
    expect(localStorage.getItem('fitlog.demoFriends')).toBeNull();
  });

  it('見本は本物の仲間として API に送らない（見本の id が通信に出ない）', async () => {
    const user = userEvent.setup();
    renderView();
    await user.click(await screen.findByRole('button', { name: 'デモ仲間 無し' }));
    await screen.findByTestId('demo-friends');
    // 見本の id（demo-…）は、どの呼び出しの宛先にも中身にも出ない
    expect(JSON.stringify(vi.mocked(fetch).mock.calls)).not.toContain('demo-');
  });
});
