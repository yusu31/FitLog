import { screen } from '@testing-library/react';
import { installFakeApi, renderWithQuery } from '@/lib/test/fake-api';
import { ProfileView } from './profile-view';

vi.mock('@/lib/auth-client', () => ({
  authClient: { useSession: () => ({ data: { user: { id: 'u1', name: 'たろう' } }, isPending: false }) },
}));
afterEach(() => vi.unstubAllGlobals());

// 自分 > プロフィール（02-9 ⑫）: 名前・キャラを変える・からだ
describe('ProfileView', () => {
  it('名前と「キャラを変える」の入口、からだの区画（体重の7日平均）からだ画面へのリンク', async () => {
    installFakeApi({
      '/api/avatar': { status: 200, body: { body: 'A', hair: 1, hairColor: 'brown', shirtColor: 'teal', pantsColor: 'navy', accessory: 'none' } },
      'GET /api/body': { status: 200, body: { heightCm: 170, latest: { date: '2026-11-18', kg: 70.2 }, bmi: 24.3, avg7: 70.4, deltaFromPrevious: -0.5, weights: [] } },
    });
    renderWithQuery(<ProfileView />);
    expect(await screen.findByText('たろう')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /キャラ/ }).some((l) => l.getAttribute('href') === '/me/chara')).toBe(true);
    expect(await screen.findByText('70.4kg')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /からだを見る/ })).toHaveAttribute('href', '/me/body');
    expect(screen.queryByRole('button', { name: 'ログアウト' })).not.toBeInTheDocument();
  });
});
