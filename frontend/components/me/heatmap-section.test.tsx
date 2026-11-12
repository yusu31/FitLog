import { screen, within } from '@testing-library/react';
import { renderWithQuery } from '@/lib/test/fake-api';
import { HEAT_COLORS } from '@/lib/heatmap';
import { HeatmapSection } from './heatmap-section';

const PARTS = ['chest', 'back', 'shoulders', 'arms', 'abs', 'glutes', 'legs'] as const;
const heatmapOf = (sets: Partial<Record<(typeof PARTS)[number], number>>) => ({
  weekStart: '2026-11-09',
  parts: PARTS.map((bodyPart) => ({ bodyPart, sets: sets[bodyPart] ?? 0 })),
});
const ROUTE = /^\/api\/me\/heatmap\?weekStart=\d{4}-\d{2}-\d{2}$/;

afterEach(() => vi.unstubAllGlobals());

// installFakeApi は完全一致の経路を引くので、日付つきの URL は fetch を包んで中身を返す
function stubHeatmap(body: unknown, status = 200) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (!ROUTE.test(url)) throw new Error(`想定外の呼び出し: ${url}`);
      return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
    }),
  );
}

describe('HeatmapSection（F-12 今週きたえたところ）', () => {
  it('合計セット数と、部位ごとのセット数を文字でも出す', async () => {
    stubHeatmap(heatmapOf({ chest: 3, legs: 5 }));
    renderWithQuery(<HeatmapSection />);
    const list = await screen.findByRole('list', { name: '部位ごとのセット数' });
    expect(within(list).getByText('胸').closest('li')).toHaveTextContent('3セット');
    expect(within(list).getByText('脚').closest('li')).toHaveTextContent('5セット');
    expect(within(list).getByText('背中').closest('li')).toHaveTextContent('0セット');
    expect(screen.getByText('今週きたえたところ').closest('section')).toHaveTextContent('8 セット');
  });

  it('体の図（前・後ろ）の色が、セット数の段階になる（胸3=段階2・脚5=段階3・他は0）', async () => {
    stubHeatmap(heatmapOf({ chest: 3, legs: 5 }));
    renderWithQuery(<HeatmapSection />);
    const front = await screen.findByTestId('body-front');
    expect(front.querySelector('[data-part="chest"]')).toHaveAttribute('fill', HEAT_COLORS[2]);
    expect(front.querySelector('[data-part="legs"]')).toHaveAttribute('fill', HEAT_COLORS[3]);
    expect(front.querySelector('[data-part="abs"]')).toHaveAttribute('fill', HEAT_COLORS[0]);
    expect(screen.getByTestId('body-back').querySelector('[data-part="glutes"]')).toHaveAttribute('fill', HEAT_COLORS[0]);
  });

  it('読み込めなかったときは、責めずに開き直しを案内する', async () => {
    stubHeatmap({ code: 'X', message: 'x', details: null }, 500);
    renderWithQuery(<HeatmapSection />);
    expect(await screen.findByText(/読み込めませんでした/)).toBeInTheDocument();
  });
});
