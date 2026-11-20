import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { hasFilmFirst, setFilmFirst } from '@/lib/film-first';
import { StartSheet } from './start-sheet';

vi.mock('@/components/record/video-recorder', () => ({ canRecordVideo: () => true }));

beforeEach(() => setFilmFirst(false));

describe('StartSheet（＋のシート）', () => {
  it('閉じているときは何も出さない', () => {
    render(<StartSheet open={false} onClose={() => {}} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('Escape で閉じる', async () => {
    const onClose = vi.fn();
    render(<StartSheet open onClose={onClose} />);
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  // 動画は保存済みの記録にひも付くので、ここでは予約だけ置く（記録画面が最初の1セットのあとに撮影を開く）
  it('「2秒動画を撮る」にチェックして筋トレを選ぶと予約が入り、ランを選ぶと入らない', async () => {
    const user = userEvent.setup();
    render(<StartSheet open onClose={() => {}} />);
    await user.click(screen.getByRole('checkbox', { name: /2秒動画を撮る/ }));
    await user.click(screen.getByRole('link', { name: '筋トレを記録' }));
    expect(hasFilmFirst()).toBe(true);
    await user.click(screen.getByRole('link', { name: 'ランを記録' }));
    expect(hasFilmFirst()).toBe(false);
  });
});
