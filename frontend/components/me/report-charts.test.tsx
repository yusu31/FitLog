import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { StatsCalendarDay } from '@/lib/api/generated';
import { renderWithQuery } from '@/lib/test/fake-api';
import { ReportCharts } from './report-charts';

// レポートのグラフ枠（02-9 PR 1。docs/testing-design.md 3-14）。今日は 2026-11-12（木曜）。
// 描画（SVG）の見た目は jsdom では測れないので、ここでは「何が出るか・切り替わるか・APIが呼ばれるか」を見る。形の数値は lib/charts.test.ts

const TODAY = '2026-11-12';
function calendar(over: Record<string, Partial<StatsCalendarDay>> = {}): StatsCalendarDay[] {
  const end = new Date(`${TODAY}T00:00:00Z`);
  return Array.from({ length: 365 }, (_, i) => {
    const d = new Date(end);
    d.setUTCDate(end.getUTCDate() - (364 - i));
    const date = d.toISOString().slice(0, 10);
    return { date, status: 'none' as const, weightKg: 0, runM: 0, workoutCount: 0, runCount: 0, ...over[date] };
  });
}

const SQUAT = '00000000-0000-4000-8000-000000000024';
const BENCH = '00000000-0000-4000-8000-000000000001';
let calls: string[] = [];
function stubApi(opts: { weights?: { date: string; kg: number; avg7: number | null }[]; items?: { exerciseId: string; name: string }[]; points?: { date: string; kg: number }[] } = {}) {
  calls = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      calls.push(url);
      const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
      if (url === '/api/body') return json({ heightCm: null, latest: null, bmi: null, avg7: null, deltaFromPrevious: null, weights: opts.weights ?? [] });
      if (url === '/api/body/one-rm') return json({ items: (opts.items ?? []).map((i) => ({ ...i, kg: 80, weightKg: 60, reps: 10, approximate: false, date: TODAY })) });
      const m = /^\/api\/body\/exercises\/([^/]+)\/max-weights$/.exec(url);
      if (m) return json({ exerciseId: m[1], name: 'スクワット', points: opts.points ?? [] });
      throw new Error(`想定外の呼び出し: ${url}`);
    }),
  );
}
afterEach(() => vi.unstubAllGlobals());

const active = () => within(screen.getByRole('group', { name: '見るグラフ' })).getAllByRole('button').find((b) => b.getAttribute('aria-pressed') === 'true')!.textContent;

describe('ReportCharts（レポートのグラフ枠）', () => {
  it('チップは 体重・動いた日・総重量・ラン・種目。筋トレの記録があれば最初は総重量', () => {
    renderWithQuery(<ReportCharts data={{ today: TODAY, calendar: calendar({ '2026-11-10': { status: 'rec', weightKg: 800, workoutCount: 1 } }) }} />);
    const names = within(screen.getByRole('group', { name: '見るグラフ' })).getAllByRole('button').map((b) => b.textContent);
    expect(names).toEqual(['体重', '動いた日', '総重量', 'ラン', '種目']);
    expect(active()).toBe('総重量');
  });

  it('筋トレの記録が1つも無く、ランだけの人は、最初がラン', () => {
    renderWithQuery(<ReportCharts data={{ today: TODAY, calendar: calendar({ '2026-11-10': { status: 'rec', runM: 5000, runCount: 1 } }) }} />);
    expect(active()).toBe('ラン');
  });

  it('棒は直近12週。「最大」と「右が今週」を文字でも出し、数字の表は開くと12行', async () => {
    renderWithQuery(<ReportCharts data={{ today: TODAY, calendar: calendar({ '2026-11-10': { status: 'rec', weightKg: 800, workoutCount: 1 }, '2026-11-02': { status: 'rec', weightKg: 1500, workoutCount: 1 } }) }} />);
    expect(screen.getAllByTestId('bar')).toHaveLength(2); // 0 の週は棒を描かない（土台の線だけ）
    expect(screen.getByRole('img', { name: /週ごとの総重量（直近12週）/ })).toBeInTheDocument();
    expect(screen.getByText('最大 1.5t・右が今週 800kg')).toBeInTheDocument();
    await userEvent.setup().click(screen.getByText('数字の表で見る'));
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(13); // 見出し＋12週
  });

  it('動いた日に切り替えると、その数字の棒と文になる', async () => {
    renderWithQuery(<ReportCharts data={{ today: TODAY, calendar: calendar({ '2026-11-10': { status: 'rec', workoutCount: 1 }, '2026-11-11': { status: 'rec', workoutCount: 1 } }) }} />);
    await userEvent.setup().click(screen.getByRole('button', { name: '動いた日' }));
    expect(screen.getByText('最大 2日・右が今週 2日')).toBeInTheDocument();
  });

  it('その期間に1つも無ければ「まだありません」と書く（責めない）', async () => {
    renderWithQuery(<ReportCharts data={{ today: TODAY, calendar: calendar() }} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'ラン' }));
    expect(screen.getAllByText('この12週はまだありません').length).toBeGreaterThan(0);
    expect(screen.queryAllByTestId('bar')).toHaveLength(0);
  });

  it('体重: 直近30日の折れ線。入っていなければ案内文', async () => {
    stubApi({ weights: [{ date: '2026-11-01', kg: 70.2, avg7: 70.2 }, { date: '2026-11-10', kg: 69.8, avg7: 70 }, { date: '2026-08-01', kg: 75, avg7: 75 }] });
    renderWithQuery(<ReportCharts data={{ today: TODAY, calendar: calendar() }} />);
    await userEvent.setup().click(screen.getByRole('button', { name: '体重' }));
    expect(await screen.findByText('直近30日・最新 69.8kg')).toBeInTheDocument();
    expect(screen.getByTestId('line-chart').querySelectorAll('circle')).toHaveLength(2); // 30日より前の点は入らない
  });

  it('体重が1件も無いときは、記録タブから入れられると案内する', async () => {
    stubApi({ weights: [] });
    renderWithQuery(<ReportCharts data={{ today: TODAY, calendar: calendar() }} />);
    await userEvent.setup().click(screen.getByRole('button', { name: '体重' }));
    expect(await screen.findByText(/体重を入れると出ます/)).toBeInTheDocument();
  });

  it('種目: 最初は先頭の種目で最大重量の API を呼び、選び直すと別の種目で呼ぶ', async () => {
    stubApi({ items: [{ exerciseId: SQUAT, name: 'スクワット' }, { exerciseId: BENCH, name: 'ベンチプレス' }], points: [{ date: '2026-11-01', kg: 60 }, { date: '2026-11-08', kg: 65 }] });
    renderWithQuery(<ReportCharts data={{ today: TODAY, calendar: calendar() }} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '種目' }));
    expect(await screen.findByText('その日の最大重量')).toBeInTheDocument();
    expect(calls).toContain(`/api/body/exercises/${SQUAT}/max-weights`);
    await user.selectOptions(screen.getByRole('combobox', { name: '種目' }), BENCH);
    await screen.findByText('その日の最大重量');
    expect(calls).toContain(`/api/body/exercises/${BENCH}/max-weights`);
  });

  it('種目: 記録が無ければ案内文。重さのある記録が無い種目も案内文', async () => {
    stubApi({ items: [] });
    renderWithQuery(<ReportCharts data={{ today: TODAY, calendar: calendar() }} />);
    await userEvent.setup().click(screen.getByRole('button', { name: '種目' }));
    expect(await screen.findByText('筋トレの記録が付くと出ます')).toBeInTheDocument();
  });

  it('種目: 点が0件（自重だけ）の種目は案内文', async () => {
    stubApi({ items: [{ exerciseId: SQUAT, name: 'スクワット' }], points: [] });
    renderWithQuery(<ReportCharts data={{ today: TODAY, calendar: calendar() }} />);
    await userEvent.setup().click(screen.getByRole('button', { name: '種目' }));
    expect(await screen.findByText('この種目は、重さのある記録がまだありません')).toBeInTheDocument();
  });
});
