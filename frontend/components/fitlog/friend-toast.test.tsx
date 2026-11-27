import { act, render, screen } from '@testing-library/react';
import type { FeedLatestFriendRecord } from '@/lib/api/generated';
import { DEFAULT_PREFS, PREFS_KEY } from '@/lib/preferences';
import { FriendToast, TOAST_MS, friendToastText } from './friend-toast';

const rec = (createdAt: string, over: Partial<FeedLatestFriendRecord> = {}): FeedLatestFriendRecord => ({
  id: `r-${createdAt}`,
  kind: 'workout',
  authorName: 'はなこ',
  createdAt,
  ...over,
});

const T1 = '2026-11-27T01:00:00.000Z';
const T2 = '2026-11-27T01:05:00.000Z';

afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
  document.body.innerHTML = '';
});

const toast = () => screen.getByTestId('friend-toast');

describe('FriendToast（仲間が記録したときの右下の知らせ。02-9 PR 7b）', () => {
  it('最初に取れた記録では出さない（基準にするだけ）。基準より新しい記録が来たら出る', () => {
    const { rerender } = render(<FriendToast latest={rec(T1)} loaded />);
    expect(toast()).toHaveAttribute('data-visible', 'false');
    rerender(<FriendToast latest={rec(T2)} loaded />);
    expect(toast()).toHaveAttribute('data-visible', 'true');
    expect(toast()).toHaveTextContent('はなこさんが筋トレを記録しました');
  });

  it('読み込み前・同じ記録の取り直しでは出ない', () => {
    const { rerender } = render(<FriendToast latest={undefined} loaded={false} />);
    rerender(<FriendToast latest={rec(T1)} loaded />);
    rerender(<FriendToast latest={rec(T1)} loaded />);
    expect(toast()).toHaveAttribute('data-visible', 'false');
  });

  it('約4秒で消える。取り直しが続いても消えるのが遅れない', () => {
    vi.useFakeTimers();
    const { rerender } = render(<FriendToast latest={rec(T1)} loaded />);
    rerender(<FriendToast latest={rec(T2)} loaded />);
    expect(toast()).toHaveAttribute('data-visible', 'true');
    act(() => vi.advanceTimersByTime(TOAST_MS - 1000));
    rerender(<FriendToast latest={rec(T2)} loaded />); // 取り直し（同じ記録・別のオブジェクト）
    act(() => vi.advanceTimersByTime(1000));
    expect(toast()).toHaveAttribute('data-visible', 'false');
  });

  it('設定の「仲間が記録したとき」がオフなら出さない', () => {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ ...DEFAULT_PREFS, notify: { ...DEFAULT_PREFS.notify, friend_record: false } }));
    const { rerender } = render(<FriendToast latest={rec(T1)} loaded />);
    rerender(<FriendToast latest={rec(T2)} loaded />);
    expect(toast()).toHaveAttribute('data-visible', 'false');
  });

  it('中央の ● の扇を開いている間は出さない', () => {
    document.body.insertAdjacentHTML('beforeend', '<div data-open="true"></div>');
    const { rerender } = render(<FriendToast latest={rec(T1)} loaded />);
    rerender(<FriendToast latest={rec(T2)} loaded />);
    expect(toast()).toHaveAttribute('data-visible', 'false');
  });

  it('読み上げは role=status（割り込まず静かに）', () => {
    render(<FriendToast latest={undefined} loaded />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
  });

  it('種類ごとの文言', () => {
    expect(friendToastText({ authorName: 'A', kind: 'run' })).toBe('Aさんがランを記録しました');
    expect(friendToastText({ authorName: 'A', kind: 'rest' })).toBe('Aさんがおやすみを記録しました');
    expect(friendToastText({ authorName: 'A', kind: 'post' })).toBe('Aさんが投稿しました');
  });
});
