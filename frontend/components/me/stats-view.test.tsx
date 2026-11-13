import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { StatsResponse } from '@/lib/api/generated';
import { STAMP_LABEL } from '@/lib/stats';
import { renderWithQuery } from '@/lib/test/fake-api';
import { StatsPage } from './stats-view';

vi.mock('@/lib/use-require-session', () => ({ useRequireSession: () => ({ signedIn: true }) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn() }), usePathname: () => '/me/stats/' }));

// 記録をくわしく（S-35・F-22・F-26・F-27・F-29。docs/testing-design.md 3-14）。今日は API が決めた today を使う（画面の時計に依存しない）
const STAMP_KEYS = Object.keys(STAMP_LABEL) as StatsResponse['stamps'][number]['key'][];

function statsOf(over: Partial<StatsResponse> = {}): StatsResponse {
  const today = '2026-11-12';
  const calendar = Array.from({ length: 365 }, (_, i) => {
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - (364 - i));
    const date = d.toISOString().slice(0, 10);
    return { date, status: (date === '2026-11-10' ? 'rest' : date === '2026-11-11' ? 'rec' : 'none') as 'rec' | 'rest' | 'none' };
  });
  return {
    today,
    calendar,
    month: { month: '2026-11', activeDays: 4, restDays: 1, totalWeightKg: 3500, runDistanceM: 12300 },
    weekly: Array.from({ length: 12 }, (_, i) => ({ weekStart: `2026-08-${String(24 + i * 7).padStart(2, '0')}`, totalWeightKg: i * 100, runDistanceM: 0 })),
    stamps: STAMP_KEYS.map((key) => ({ key, earned: key === 'first-record' || key === 'weight-1t' })),
    totalRunDistanceM: 12300,
    ...over,
  };
}

function stubStats(body: unknown, status = 200) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (!/^\/api\/me\/stats\?date=\d{4}-\d{2}-\d{2}$/.test(url)) throw new Error(`想定外の呼び出し: ${url}`);
      return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
    }),
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('StatsPage（S-35 記録をくわしく）', () => {
  it('今月の数字（動いた日・おやすみ・総重量・ラン）と、総重量の換算を出す', async () => {
    stubStats(statsOf());
    renderWithQuery(<StatsPage />);
    const section = (await screen.findByText('11月の数字')).closest('section')!;
    expect(section).toHaveTextContent('4 日');
    expect(section).toHaveTextContent('1 日');
    expect(section).toHaveTextContent('3500 kg');
    expect(section).toHaveTextContent('12.3 km');
    expect(section).toHaveTextContent('軽自動車 3台ぶん');
  });

  it('マスは週が初期表示（7マス）。月・年に切り替えると数が変わり、休みはどの期間でも「おやすみ」の札で出る', async () => {
    stubStats(statsOf());
    renderWithQuery(<StatsPage />);
    const grid = await screen.findByTestId('stats-grid');
    expect(within(grid).getAllByRole('listitem')).toHaveLength(7);
    expect(within(grid).getByLabelText('11/10 おやすみ')).toHaveAttribute('data-status', 'rest');

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '月' }));
    expect(screen.getByRole('button', { name: '月' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(screen.getByTestId('stats-grid')).getByLabelText('11/10 おやすみ')).toHaveAttribute('data-status', 'rest');
    expect(within(screen.getByTestId('stats-grid')).getAllByRole('listitem').filter((li) => li.hasAttribute('data-status'))).toHaveLength(30);

    await user.click(screen.getByRole('button', { name: '年' }));
    expect(within(screen.getByTestId('stats-grid')).getAllByRole('listitem').filter((li) => li.hasAttribute('data-status'))).toHaveLength(365);
    expect(within(screen.getByTestId('stats-grid')).getByLabelText('11/10 おやすみ')).toHaveAttribute('data-status', 'rest');
  });

  it('スタンプ帳は全部並べ、獲得済みとまだを文字でも区別する。「あと◯」は出さない', async () => {
    stubStats(statsOf());
    renderWithQuery(<StatsPage />);
    const stamps = (await screen.findByText('スタンプ帳')).closest('section')!;
    expect(within(stamps).getAllByRole('listitem')).toHaveLength(STAMP_KEYS.length);
    expect(within(stamps).getByText('初めての記録').closest('li')).toHaveTextContent('獲得済み');
    expect(within(stamps).getByText('初めての5km').closest('li')).toHaveTextContent('まだ');
    expect(stamps.textContent).not.toMatch(/あと/);
  });

  it('日本縦断: 累計距離から今いる場所だけを文で出し、「あと◯km」は出さない（F-28）', async () => {
    stubStats(statsOf({ totalRunDistanceM: 300_000 }));
    renderWithQuery(<StatsPage />);
    const trek = (await screen.findByText('日本縦断')).closest('section')!;
    expect(trek).toHaveTextContent('300km');
    expect(trek).toHaveTextContent('福岡');
    expect(within(trek).getByTestId('trek-total')).toHaveTextContent('300.0 km'); // 合計の走行距離
    expect(trek).toHaveTextContent('次の広島まで 260.0km'); // 福岡(270km)の次は広島(560km)
    expect(trek.textContent).not.toMatch(/あと|残り/);
    expect(within(trek).getByRole('img', { name: /福岡/ })).toBeInTheDocument();
  });

  it('日本縦断: まだ走っていなくても出発点（鹿児島）で出す。3000km を超えたら2周目', async () => {
    stubStats(statsOf({ totalRunDistanceM: 0 }));
    const first = renderWithQuery(<StatsPage />);
    expect((await screen.findByText('日本縦断')).closest('section')).toHaveTextContent('次の福岡まで 270.0km');
    first.unmount();
    stubStats(statsOf({ totalRunDistanceM: 3_500_000 }));
    renderWithQuery(<StatsPage />);
    const second = (await screen.findByText('日本縦断')).closest('section')!;
    expect(second).toHaveTextContent('1回達成');
    expect(second).toHaveTextContent('2周目');
  });

  it('グラフは、読み上げ用に週ごとの数字も持つ（直近12週）', async () => {
    stubStats(statsOf());
    renderWithQuery(<StatsPage />);
    const list = await screen.findByRole('list', { name: '週ごとの総重量の数字' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(12);
    expect(within(list).getAllByRole('listitem')[11]).toHaveTextContent('1100kg');
  });

  it('記録がまったく無くても、責めずに表示できる（換算は出ない・スタンプはすべてまだ）', async () => {
    stubStats(
      statsOf({
        month: { month: '2026-11', activeDays: 0, restDays: 0, totalWeightKg: 0, runDistanceM: 0 },
        stamps: STAMP_KEYS.map((key) => ({ key, earned: false })),
      }),
    );
    renderWithQuery(<StatsPage />);
    const section = (await screen.findByText('11月の数字')).closest('section')!;
    expect(section.textContent).not.toMatch(/ぶん/);
  });

  it('読み込めなかったときは、責めずに開き直しを案内する', async () => {
    stubStats({ code: 'X', message: 'x', details: null }, 500);
    renderWithQuery(<StatsPage />);
    expect(await screen.findByText(/読み込めませんでした/)).toBeInTheDocument();
  });
});
