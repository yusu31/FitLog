import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { StatsResponse } from '@/lib/api/generated';
import { STAMP_LABEL } from '@/lib/stats';
import { renderWithQuery } from '@/lib/test/fake-api';
import { StatsPage } from './stats-view';

vi.mock('@/lib/use-require-session', () => ({ useRequireSession: () => ({ signedIn: true }) }));
// 本物の地図は WebGL が要り jsdom では動かない。部品を差し替える（描画は実ブラウザで確かめる）
vi.mock('@/components/me/japan-map', () => ({ JapanMap: ({ pos }: { pos: { name: string } }) => <div role="img" aria-label={`いまは${pos.name}のあたり`} /> }));
// ?metric=m のような、画面の URL のクエリ（各テストで入れ替える）
let query = '';
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn() }), usePathname: () => '/me/stats/', useSearchParams: () => new URLSearchParams(query) }));
beforeEach(() => {
  query = '';
});

// 記録のまとめ（S-35・F-22・F-26・F-27・F-29。docs/testing-design.md 3-14）。今日は API が決めた today を使う（画面の時計に依存しない）
const STAMP_KEYS = Object.keys(STAMP_LABEL) as StatsResponse['stamps'][number]['key'][];

function statsOf(over: Partial<StatsResponse> = {}): StatsResponse {
  const today = '2026-11-12';
  const calendar = Array.from({ length: 365 }, (_, i) => {
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - (364 - i));
    const date = d.toISOString().slice(0, 10);
    const status = (date === '2026-11-10' ? 'rest' : date === '2026-11-11' || date === '2026-11-03' ? 'rec' : 'none') as 'rec' | 'rest' | 'none';
    return { date, status, weightKg: date === '2026-11-11' ? 800 : date === '2026-11-03' ? 2700 : 0, runM: date === '2026-11-11' ? 5000 : date === '2026-11-03' ? 7300 : 0 };
  });
  return {
    today,
    calendar,
    week: { activeDays: 2, restDays: 1, totalWeightKg: 800, runDistanceM: 5000 },
    month: { month: '2026-11', activeDays: 4, restDays: 1, totalWeightKg: 3500, runDistanceM: 12300 },
    year: { activeDays: 40, restDays: 6, totalWeightKg: 42000, runDistanceM: 120000 },
    weekly: Array.from({ length: 12 }, (_, i) => ({ weekStart: `2026-08-${String(24 + i * 7).padStart(2, '0')}`, totalWeightKg: i * 100, runDistanceM: 0 })),
    stamps: STAMP_KEYS.map((key) => ({ key, earned: key === 'first-record' || key === 'weight-1t', earnedAt: key === 'first-record' ? '2026-11-03' : key === 'weight-1t' ? '2026-11-16' : null })),
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

describe('StatsPage（S-35 記録のまとめ）', () => {
  it('初期は週。今週の合計4つ（動いた日・おやすみ・総重量・ラン）と、6週のタイル', async () => {
    stubStats(statsOf());
    renderWithQuery(<StatsPage />);
    expect(await screen.findByTestId('stats-title')).toHaveTextContent('11/9〜11/15');
    const totals = screen.getByTestId('stats-totals');
    expect(totals).toHaveTextContent('動いた日1日');
    expect(totals).toHaveTextContent('おやすみ1日');
    expect(totals).toHaveTextContent('800kg');
    expect(totals).toHaveTextContent('5.0km');
    const tiles = within(screen.getByTestId('stats-tiles')).getAllByRole('button');
    expect(tiles).toHaveLength(6);
    expect(tiles[5]).toHaveAttribute('aria-pressed', 'true'); // 右端が今週
    expect(tiles[5]).toHaveAccessibleName('11/9〜 1日');
  });

  it('◀で先週へ。押した週のタイルでもその週へ移る。今週より先へは進めない', async () => {
    stubStats(statsOf());
    renderWithQuery(<StatsPage />);
    const user = userEvent.setup();
    await screen.findByTestId('stats-title');
    expect(screen.getByRole('button', { name: '次へ' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: '前へ' }));
    expect(screen.getByTestId('stats-title')).toHaveTextContent('11/2〜11/8');
    expect(screen.getByRole('button', { name: '次へ' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: /^10\/26〜/ }));
    expect(screen.getByTestId('stats-title')).toHaveTextContent('10/26〜11/1');
  });

  it('月に切り替えると、今月の合計・日付つきカレンダー・6か月のタイル。総重量の換算も出す', async () => {
    stubStats(statsOf());
    renderWithQuery(<StatsPage />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: '月' }));
    expect(screen.getByTestId('stats-title')).toHaveTextContent('2026年11月');
    const totals = screen.getByTestId('stats-totals');
    expect(totals).toHaveTextContent('動いた日2日');
    expect(totals).toHaveTextContent('3.5t');
    expect(totals).toHaveTextContent('12.3km');
    expect(screen.getByText('軽自動車 3台ぶん')).toBeInTheDocument();
    const grid = screen.getByTestId('stats-grid');
    expect(within(grid).getAllByRole('listitem').filter((li) => li.hasAttribute('data-status'))).toHaveLength(30);
    expect(within(grid).getByLabelText('11/10 おやすみ')).toHaveAttribute('data-status', 'rest');
    expect(within(grid).getByLabelText('11/10 おやすみ')).toHaveTextContent('10');
    expect(screen.getByTestId('stats-weekdays').textContent).toBe('月火水木金土日');
    expect(within(screen.getByTestId('stats-tiles')).getAllByRole('button')).toHaveLength(6);
  });

  // D5-2: 週・月・年を同じマス部品にそろえる。週は7マスの帯（日付つき）
  it('週は月〜日の7マスの帯。日付つきで、休みは紫・記録は金・先の日は none', async () => {
    stubStats(statsOf());
    renderWithQuery(<StatsPage />);
    await screen.findByTestId('stats-title');
    const grid = screen.getByTestId('stats-grid');
    const cells = within(grid).getAllByRole('listitem');
    expect(cells).toHaveLength(7);
    expect(cells.map((c) => c.textContent)).toEqual(['9', '10', '11', '12', '13', '14', '15']);
    expect(within(grid).getByLabelText('11/10 おやすみ')).toHaveAttribute('data-status', 'rest');
    expect(within(grid).getByLabelText('11/11 記録あり')).toHaveAttribute('data-status', 'rec');
    expect(within(grid).getByLabelText('11/13')).toHaveAttribute('data-status', 'none');
    expect(screen.getByTestId('stats-weekdays').textContent).toBe('月火水木金土日');
  });

  it('週の◀で先週の帯に変わる（マスも先週の日付）', async () => {
    stubStats(statsOf());
    renderWithQuery(<StatsPage />);
    const user = userEvent.setup();
    await screen.findByTestId('stats-title');
    await user.click(screen.getByRole('button', { name: '前へ' }));
    const cells = within(screen.getByTestId('stats-grid')).getAllByRole('listitem');
    expect(cells.map((c) => c.textContent)).toEqual(['2', '3', '4', '5', '6', '7', '8']);
    expect(within(screen.getByTestId('stats-grid')).getByLabelText('11/3 記録あり')).toBeInTheDocument();
  });

  it('年は月ごとの小さなカレンダー12個（日付の数字なし・色だけ）。◀▶があり、タイルを押すとその月へ移る', async () => {
    stubStats(statsOf());
    renderWithQuery(<StatsPage />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: '年' }));
    expect(screen.getByTestId('stats-title')).toHaveTextContent('2025年12月〜2026年11月');
    const months = screen.getAllByTestId('stats-year-month');
    expect(months).toHaveLength(12);
    expect(months[0]).toHaveTextContent('12月');
    expect(months[11]).toHaveTextContent('11月');
    // 日付の数字は出さない（マスは色だけ）。休みは月と同じ紫
    const nov = within(months[11]!);
    expect(nov.getByLabelText('11/10 おやすみ')).toHaveAttribute('data-status', 'rest');
    expect(nov.getByLabelText('11/10 おやすみ').textContent).toBe('');
    expect(nov.getByLabelText('11/12 今日')).toHaveClass('ring-1');
    expect(screen.getByRole('button', { name: '次へ' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '前へ' })).toBeEnabled();
    expect(within(screen.getByTestId('stats-tiles')).getAllByRole('button')).toHaveLength(12);
    await user.click(screen.getByRole('button', { name: /^10月 / }));
    expect(screen.getByTestId('stats-title')).toHaveTextContent('2026年10月');
    expect(screen.getByRole('button', { name: '月' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('年の◀▶は1か月ずつ。戻れるのは最初の記録の月まで（今の calendar なら1か月前まで）', async () => {
    stubStats(statsOf());
    renderWithQuery(<StatsPage />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: '年' }));
    await user.click(screen.getByRole('button', { name: '前へ' }));
    expect(screen.getByTestId('stats-title')).toHaveTextContent('2025年11月〜2026年10月');
    expect(screen.getByRole('button', { name: '前へ' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: '次へ' }));
    expect(screen.getByTestId('stats-title')).toHaveTextContent('2025年12月〜2026年11月');
  });

  it('見る数字を切り替えるとタイルの数字が変わる。日本縦断はラン（距離）のときだけ出る', async () => {
    stubStats(statsOf());
    renderWithQuery(<StatsPage />);
    const user = userEvent.setup();
    await screen.findByTestId('stats-title');
    expect(screen.queryByText('日本縦断')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '総重量' }));
    expect(screen.getByRole('button', { name: '11/9〜 800kg' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'ラン' }));
    expect(screen.getByRole('button', { name: '11/9〜 5.0km' })).toBeInTheDocument();
    expect(screen.getByText('日本縦断')).toBeInTheDocument();
  });

  // L6・D4-4: 「日本地図で見る」は ?metric=m で来る。最初からランを選び、日本縦断の地図を出す
  it('?metric=m で開くと、最初からランが選ばれ、日本縦断の地図が出る（クリック不要）', async () => {
    query = 'metric=m';
    stubStats(statsOf());
    renderWithQuery(<StatsPage />);
    await screen.findByTestId('stats-title');
    expect(screen.getByRole('button', { name: 'ラン' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '動いた日' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('日本縦断')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /のあたり/ })).toBeInTheDocument();
  });

  it('?metric が無い・知らない値のときは、今までどおり「動いた日」で、地図は出ない', async () => {
    for (const q of ['', 'metric=zzz', 'metric=']) {
      query = q;
      stubStats(statsOf());
      const { unmount } = renderWithQuery(<StatsPage />);
      await screen.findByTestId('stats-title');
      expect(screen.getByRole('button', { name: '動いた日' })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.queryByText('日本縦断')).not.toBeInTheDocument();
      unmount();
    }
  });

  it('日本縦断の見出しの下に、進み方を1行で説明する（南の鹿児島から北の稚内へ）', async () => {
    query = 'metric=m';
    stubStats(statsOf());
    renderWithQuery(<StatsPage />);
    await screen.findByTestId('stats-title');
    expect(screen.getByText('走った距離で、日本を南の鹿児島から北の稚内へ進みます')).toBeInTheDocument();
  });

  it('A08-6・V-04: まだのスタンプは灰色のメダルで、文字は面の上で 4.5:1 以上の濃さ。とったものは色つき', async () => {
    stubStats(statsOf());
    renderWithQuery(<StatsPage />);
    const stamps = (await screen.findByText('スタンプ帳')).closest('section')!;
    const all = within(stamps.querySelector('[data-testid="all-stamps"]') as HTMLElement);
    const notYet = all.getByText('初めての5km').closest('li')!;
    expect(notYet.className).toContain('text-fg-muted');
    expect(notYet.querySelector('[data-testid="stamp-medal"]')).toHaveAttribute('data-earned', 'false');
    expect(all.getByText('初めての記録').closest('li')!.querySelector('[data-testid="stamp-medal"]')).toHaveAttribute('data-earned', 'true');
  });

  it('最近とった4つを帳の上に出す（新しい順）。まだ1つもなければ出さない', async () => {
    stubStats(statsOf());
    renderWithQuery(<StatsPage />);
    const stamps = (await screen.findByText('スタンプ帳')).closest('section')!;
    const recent = within(stamps.querySelector('[data-testid="recent-stamps"]') as HTMLElement).getAllByRole('listitem');
    expect(recent.length).toBeGreaterThan(0);
    expect(recent.length).toBeLessThanOrEqual(4);
    expect(recent[0]).toHaveTextContent('総重量1t'); // 11/16 が最新
  });

  it('スタンプ帳は全部並べ、獲得済みとまだを文字でも区別する。「あと◯」は出さない', async () => {
    stubStats(statsOf());
    renderWithQuery(<StatsPage />);
    const stamps = (await screen.findByText('スタンプ帳')).closest('section')!.querySelector('[data-testid="all-stamps"]') as HTMLElement;
    expect(within(stamps).getAllByRole('listitem')).toHaveLength(STAMP_KEYS.length);
    expect(within(stamps).getByText('初めての記録').closest('li')).toHaveTextContent('獲得済み');
    expect(within(stamps).getByText('初めての5km').closest('li')).toHaveTextContent('まだ');
    expect(stamps.textContent).not.toMatch(/あと/);
  });

  it('獲得済みのスタンプには取得日（月/日）を出す。まだのスタンプには出さない（U10）', async () => {
    stubStats(statsOf());
    renderWithQuery(<StatsPage />);
    const stamps = (await screen.findByText('スタンプ帳')).closest('section')!.querySelector('[data-testid="all-stamps"]') as HTMLElement;
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

  it('記録がまったく無くても、責めずに表示できる（換算は出ない・スタンプはすべてまだ）', async () => {
    stubStats(
      statsOf({
        calendar: statsOf().calendar.map((c) => ({ ...c, status: 'none' as const, weightKg: 0, runM: 0 })),
        stamps: STAMP_KEYS.map((key) => ({ key, earned: false, earnedAt: null })),
      }),
    );
    renderWithQuery(<StatsPage />);
    await screen.findByTestId('stats-title');
    expect(screen.getByTestId('stats-totals')).toHaveTextContent('動いた日0日');
    expect(document.body.textContent).not.toMatch(/ぶん/);
  });

  it('読み込めなかったときは、責めずに開き直しを案内する', async () => {
    stubStats({ code: 'X', message: 'x', details: null }, 500);
    renderWithQuery(<StatsPage />);
    expect(await screen.findByText(/読み込めませんでした/)).toBeInTheDocument();
  });
});
