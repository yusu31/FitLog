import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { StatsResponse } from '@/lib/api/generated';
import { STAMP_LABEL } from '@/lib/stats';
import { renderWithQuery } from '@/lib/test/fake-api';
import { StatsPage } from './stats-view';

vi.mock('@/lib/use-require-session', () => ({ useRequireSession: () => ({ signedIn: true }) }));
// 本物の地図は WebGL が要り jsdom では動かない。部品を差し替える（描画は実ブラウザで確かめる）
vi.mock('@/components/me/japan-map', () => ({ JapanMap: ({ pos }: { pos: { name: string } }) => <div role="img" aria-label={`いまは${pos.name}のあたり`} /> }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn() }), usePathname: () => '/me/stats/' }));

// 記録のまとめ（S-35・F-22・F-26・F-27・F-29。docs/testing-design.md 3-14）。今日は API が決めた today を使う（画面の時計に依存しない）
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
    stamps: STAMP_KEYS.map((key) => ({ key, earned: key === 'first-record' || key === 'weight-1t', earnedAt: key === 'first-record' ? '2026-11-03' : key === 'weight-1t' ? '2026-11-16' : null })),
    totalRunDistanceM: 12300,
    ...over,
  };
}

// 12週ぶんの週ごとの数字。2026-11-09（今週）から7日ずつさかのぼる
function weeksOf(weight: (i: number) => number, run: (i: number) => number) {
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date('2026-11-09T00:00:00Z');
    d.setUTCDate(d.getUTCDate() - (11 - i) * 7);
    return { weekStart: d.toISOString().slice(0, 10), totalWeightKg: weight(i), runDistanceM: run(i) };
  });
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

describe('StatsPage（S-35 記録のまとめ）', () => {
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

  it('A08-4: 週・月・年のどのマスにも曜日の見出しが付く', async () => {
    stubStats(statsOf());
    renderWithQuery(<StatsPage />);
    const row = await screen.findByTestId('stats-weekdays');
    expect(row.textContent).toMatch(/^[日月火水木金土]{7}$/);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '月' }));
    expect(screen.getByTestId('stats-weekdays').textContent).toBe('月火水木金土日');
    await user.click(screen.getByRole('button', { name: '年' }));
    expect(screen.getByTestId('stats-weekdays')).toHaveTextContent('上から月〜日'); // 年はマスが細かいので、読み方の一文
  });

  it('A08-5: 上のマスだけが週・月・年で切り替わることを文で伝える。数字の見出しに期間（月初〜今日）を出す', async () => {
    stubStats(statsOf());
    renderWithQuery(<StatsPage />);
    expect(await screen.findByText(/切り替わるのはこのマスだけ/)).toBeInTheDocument();
    const section = screen.getByText('11月の数字').closest('section')!;
    expect(section).toHaveTextContent('11/1〜11/12');
  });

  it('A08-8: 筋トレ・ランの切替タブ。初期は筋トレ（総重量のグラフ）で、ランのグラフ・日本縦断は隠れている', async () => {
    stubStats(statsOf());
    renderWithQuery(<StatsPage />);
    expect(await screen.findByRole('region', { name: '週ごとの総重量' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: '週ごとのラン' })).not.toBeInTheDocument();
    expect(screen.queryByText('日本縦断')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '筋トレ' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.setup().click(screen.getByRole('button', { name: 'ラン' }));
    expect(screen.getByRole('button', { name: 'ラン' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('region', { name: '週ごとのラン' })).toBeInTheDocument();
    expect(screen.getByText('日本縦断')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: '週ごとの総重量' })).not.toBeInTheDocument();
  });

  it('A08-8: 筋トレの記録が無くランだけの人は、最初からランのタブで開く', async () => {
    stubStats(statsOf({ weekly: weeksOf(() => 0, (i) => (i >= 9 ? 3000 : 0)) }));
    renderWithQuery(<StatsPage />);
    expect(await screen.findByRole('region', { name: '週ごとのラン' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ラン' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('A08-2・A08-3: グラフは記録を始めた週から右だけを出し、左端の週の日付と「今週」をラベルにする', async () => {
    stubStats(statsOf({ weekly: weeksOf((i) => (i >= 9 ? 100 : 0), () => 0) }));
    renderWithQuery(<StatsPage />);
    const section = await screen.findByRole('region', { name: '週ごとの総重量' });
    expect(within(section).getAllByRole('listitem')).toHaveLength(3);
    expect(section.querySelectorAll('svg rect[data-bar]')).toHaveLength(3);
    const labels = within(section).getByTestId('chart-labels');
    expect(labels).toHaveTextContent('10/26の週');
    expect(labels).toHaveTextContent('今週');
  });

  it('A08-2: まだ記録の無いほうのグラフは、空の棒でなく一言の案内にする', async () => {
    stubStats(statsOf({ weekly: weeksOf(() => 0, () => 0), totalRunDistanceM: 0 }));
    renderWithQuery(<StatsPage />);
    const section = await screen.findByRole('region', { name: '週ごとの総重量' });
    expect(section.querySelectorAll('svg rect[data-bar]')).toHaveLength(0);
    expect(section).toHaveTextContent('記録するとここに');
  });

  it('A08-6・V-04: まだのスタンプは☆で欠けを見せない（星は獲得済みだけ）。文字は面の上で 4.5:1 以上の濃さ', async () => {
    stubStats(statsOf());
    renderWithQuery(<StatsPage />);
    const stamps = (await screen.findByText('スタンプ帳')).closest('section')!;
    const notYet = within(stamps).getByText('初めての5km').closest('li')!;
    expect(notYet.textContent).not.toContain('☆');
    expect(notYet.className).toContain('text-sub-strong');
    expect(within(stamps).getByText('初めての記録').closest('li')!.textContent).toContain('★');
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

  it('獲得済みのスタンプには取得日（月/日）を出す。まだのスタンプには出さない（U10）', async () => {
    stubStats(statsOf());
    renderWithQuery(<StatsPage />);
    const stamps = (await screen.findByText('スタンプ帳')).closest('section')!;
    expect(within(stamps).getByText('初めての記録').closest('li')).toHaveTextContent('11/3');
    expect(within(stamps).getByText('総重量1t').closest('li')).toHaveTextContent('11/16');
    expect(within(stamps).getByText('初めての5km').closest('li')).not.toHaveTextContent(/\d+\/\d+/);
  });

  it('日本縦断: 累計距離から今いる場所だけを文で出し、「あと◯km」は出さない（F-28）', async () => {
    stubStats(statsOf({ totalRunDistanceM: 300_000 }));
    renderWithQuery(<StatsPage />);
    await userEvent.setup().click(await screen.findByRole('button', { name: 'ラン' }));
    const trek = (await screen.findByText('日本縦断')).closest('section')!;
    expect(trek).toHaveTextContent('300km');
    expect(trek).toHaveTextContent('福岡');
    expect(within(trek).getByTestId('trek-total')).toHaveTextContent('300.0 km'); // 合計の走行距離
    expect(trek).toHaveTextContent('次の下関まで 30.0km'); // 福岡(270km)の次は下関(330km)
    expect(trek.textContent).not.toMatch(/あと|残り/);
    expect(within(trek).getByRole('img', { name: /福岡/ })).toBeInTheDocument();
  });

  it('日本縦断: まだ走っていなくても出発点（鹿児島）で出す。3000km を超えたら2周目', async () => {
    stubStats(statsOf({ totalRunDistanceM: 0 }));
    const first = renderWithQuery(<StatsPage />);
    await userEvent.setup().click(await screen.findByRole('button', { name: 'ラン' }));
    expect((await screen.findByText('日本縦断')).closest('section')).toHaveTextContent('次の熊本まで 170.0km');
    first.unmount();
    stubStats(statsOf({ totalRunDistanceM: 3_500_000 }));
    renderWithQuery(<StatsPage />);
    await userEvent.setup().click(await screen.findByRole('button', { name: 'ラン' }));
    const second = (await screen.findByText('日本縦断')).closest('section')!;
    expect(second).toHaveTextContent('1回達成');
    expect(second).toHaveTextContent('2周目');
  });

  it('グラフは、読み上げ用に週ごとの数字も持つ（始めた週から）', async () => {
    stubStats(statsOf());
    renderWithQuery(<StatsPage />);
    const list = await screen.findByRole('list', { name: '週ごとの総重量の数字' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(11); // 0kg の最初の1週は出さない（A08-2）
    expect(within(list).getAllByRole('listitem')[10]).toHaveTextContent('1100kg');
  });

  it('U8: グラフに、いちばん多い週と今週の数字を見える文字で出す', async () => {
    stubStats(statsOf());
    renderWithQuery(<StatsPage />);
    const section = (await screen.findByRole('region', { name: '週ごとの総重量' }));
    expect(section).toHaveTextContent('最大');
    expect(section).toHaveTextContent('右が今週 1100kg');
  });

  it('記録がまったく無くても、責めずに表示できる（換算は出ない・スタンプはすべてまだ）', async () => {
    stubStats(
      statsOf({
        month: { month: '2026-11', activeDays: 0, restDays: 0, totalWeightKg: 0, runDistanceM: 0 },
        stamps: STAMP_KEYS.map((key) => ({ key, earned: false, earnedAt: null })),
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
