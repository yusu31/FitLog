import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
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
afterEach(() => vi.unstubAllGlobals());

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

  it('グループが無いときは、足跡を読みに行かず、仲間タブへ案内する', async () => {
    routes['/api/groups/current'] = { status: 404, body: { code: 'NOT_FOUND', message: 'x', details: null } };
    renderView();
    expect(await screen.findByRole('link', { name: '仲間を探す' })).toHaveAttribute('href', '/friends');
    expect(calls).not.toContain('/api/feed');
  });
});
