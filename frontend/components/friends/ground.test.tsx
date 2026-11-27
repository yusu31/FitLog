import { act, render, screen } from '@testing-library/react';
import type { GroupDetailResponse } from '@/lib/api/generated';
import { Ground, TODAY_POSE } from './ground';

const AVATAR = { body: 'A', hair: 1, hairColor: 'brown', shirtColor: 'teal', pantsColor: 'navy', accessory: 'none' };
const GROUP: GroupDetailResponse = {
  id: 'g1',
  name: '朝トレ部',
  description: null,
  background: 'park',
  members: [
    { id: 'u1', name: 'たろう', avatar: AVATAR, today: 'workout' },
    { id: 'u2', name: 'はなこ', avatar: AVATAR, today: 'run' },
    { id: 'u3', name: 'じろう', avatar: AVATAR, today: 'rest' },
    { id: 'u4', name: 'さぶろう', avatar: AVATAR, today: 'none' },
  ],
};

const reduceMotion = (on: boolean) =>
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: on && query.includes('reduce'), addEventListener: () => {}, removeEventListener: () => {} }));

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('Ground（運動場。02-9 PR 6）', () => {
  it('ミッションの背景の絵が敷かれる', () => {
    render(<Ground group={GROUP} />);
    const scene = screen.getByTestId('ground');
    expect(scene).toHaveAttribute('data-background', 'park');
    expect(scene.style.backgroundImage).toContain('/ground/park.png');
  });

  it('メンバーの今日のようすが、ポーズと読み上げになる（筋トレ済み・ラン済み・休み・まだ）', () => {
    render(<Ground group={GROUP} />);
    expect(TODAY_POSE).toEqual({ workout: 'cheer', run: 'run', rest: 'relax', none: 'idle' });
    const poses = screen.getAllByTestId('chara').map((c) => c.getAttribute('data-pose'));
    expect(poses).toEqual(['cheer', 'run', 'relax', 'idle']);
    expect(screen.getByRole('img', { name: '公園：たろうは筋トレ済み、はなこはラン済み、じろうは休み、さぶろうはまだ' })).toBeInTheDocument();
  });

  it('名前が上に出る', () => {
    render(<Ground group={GROUP} />);
    expect(screen.getByText('たろう')).toBeInTheDocument();
    expect(screen.getByText('さぶろう')).toBeInTheDocument();
  });

  it('ときどき1人が少し歩き、歩き終わるともとのポーズに戻る', () => {
    vi.useFakeTimers();
    reduceMotion(false);
    render(<Ground group={GROUP} />);
    expect(screen.queryAllByTestId('ground-member').filter((m) => m.dataset.walking)).toHaveLength(0);
    act(() => void vi.advanceTimersByTime(7000));
    const walking = screen.getAllByTestId('ground-member').filter((m) => m.dataset.walking === 'true');
    expect(walking).toHaveLength(1);
    expect(walking[0]).toHaveAttribute('data-today', 'workout');
    expect(walking[0].querySelector('[data-testid="chara"]')).toHaveAttribute('data-pose', 'run');
    act(() => void vi.advanceTimersByTime(2400));
    expect(screen.getAllByTestId('ground-member').filter((m) => m.dataset.walking)).toHaveLength(0);
    expect(screen.getAllByTestId('chara')[0]).toHaveAttribute('data-pose', 'cheer');
  });

  it('「動きを減らす」設定のときは歩かない', () => {
    vi.useFakeTimers();
    reduceMotion(true);
    render(<Ground group={GROUP} />);
    act(() => void vi.advanceTimersByTime(20000));
    expect(screen.getAllByTestId('ground-member').filter((m) => m.dataset.walking)).toHaveLength(0);
  });

  it('1人のときは歩かない', () => {
    vi.useFakeTimers();
    reduceMotion(false);
    render(<Ground group={{ ...GROUP, members: GROUP.members.slice(0, 1) }} />);
    act(() => void vi.advanceTimersByTime(20000));
    expect(screen.getAllByTestId('ground-member').filter((m) => m.dataset.walking)).toHaveLength(0);
  });
});
