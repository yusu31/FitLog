import { screen } from '@testing-library/react';
import { toLocalDate } from '@/lib/shared/local-date';
import { installFakeApi, renderWithQuery, weekOf } from '@/lib/test/fake-api';
import { LogView } from './log-view';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
afterEach(() => vi.unstubAllGlobals());

const TODAY = toLocalDate(new Date());

// 記録タブ（02-9 ⑫）: 今日の中身の下に、記録の一覧と「レポートを見る」
describe('LogView', () => {
  it('7マス・記録の一覧・「レポートを見る」（/me へ）が並ぶ', async () => {
    installFakeApi({
      [`/api/week?date=${TODAY}`]: { status: 200, body: weekOf(TODAY) },
      '/api/records?kind=workout&limit=5': { status: 200, body: { items: [], nextCursor: null } },
      '/api/records?limit=1': { status: 200, body: { items: [], nextCursor: null } },
      '/api/records?limit=20': { status: 200, body: { items: [], nextCursor: null } },
      '/api/routines': { status: 200, body: { items: [] } },
      '/api/body': { status: 200, body: { heightCm: null, latest: null, bmi: null, avg7: null, deltaFromPrevious: null, weights: [] } },
      '/api/avatar': { status: 404, body: { code: 'NOT_FOUND', message: 'x', details: null } },
    });
    renderWithQuery(<LogView />);
    expect(await screen.findByRole('link', { name: 'レポートを見る' })).toHaveAttribute('href', '/me');
    expect(screen.getByRole('heading', { level: 1, name: '記録' })).toBeInTheDocument();
    expect(await screen.findByText('まだ記録がありません')).toBeInTheDocument();
    // 体重の帯は、レポートを見るリンクの上に1行で出る
    expect(await screen.findByRole('button', { name: '今日の体重を入れる' })).toBeInTheDocument();
  });
});
