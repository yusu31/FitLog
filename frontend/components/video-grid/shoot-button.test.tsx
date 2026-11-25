import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { hasFilmFirst, setFilmFirst } from '@/lib/film-first';
import { toLocalDate } from '@/lib/shared/local-date';
import { installFakeApi, renderWithQuery } from '@/lib/test/fake-api';
import { VIDEO_GRID_MESSAGES } from './messages';
import { ShootButton } from './shoot-button';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
let capable = true;
vi.mock('@/components/record/video-recorder', () => ({
  canRecordVideo: () => capable,
  VideoRecorder: ({ recordId, onClose }: { recordId: string; onClose: () => void }) => (
    <button type="button" onClick={onClose}>{`撮影 ${recordId}`}</button>
  ),
}));

const records = (items: unknown[]) => installFakeApi({ '/api/records?kind=workout&limit=5': { status: 200, body: { items, nextCursor: null } } });
const rec = (id: string, localDate: string, over = {}) => ({ id, kind: 'workout', recordedAt: `${localDate}T01:00:00.000Z`, localDate, ...over });
const today = toLocalDate(new Date());

beforeEach(() => {
  capable = true;
  setFilmFirst(false);
});
afterEach(() => {
  vi.unstubAllGlobals();
  push.mockReset();
});

async function press() {
  const button = await screen.findByRole('button', { name: VIDEO_GRID_MESSAGES.shoot });
  await waitFor(() => expect(button).toBeEnabled());
  await userEvent.click(button);
}

describe('ShootButton（鍵から撮りにいく。#438）', () => {
  it('今日の筋トレの記録があれば、その記録の撮影をその場で開き、閉じられる', async () => {
    records([rec('r1', today)]);
    renderWithQuery(<ShootButton />);
    await press();
    await userEvent.click(screen.getByRole('button', { name: '撮影 r1' }));
    expect(screen.queryByRole('button', { name: '撮影 r1' })).not.toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
    expect(hasFilmFirst()).toBe(false);
  });

  it('今日の記録が無い（前の日だけ・あとから記録だけ）なら、最初の1セットのあとに撮る予約をして種目選びへ', async () => {
    records([rec('late', today, { late: true }), rec('old', '2026-01-01')]);
    renderWithQuery(<ShootButton />);
    await press();
    expect(push).toHaveBeenCalledWith('/exercises');
    expect(hasFilmFirst()).toBe(true);
  });

  it('撮れない端末では、ボタンを出さず理由だけ', () => {
    capable = false;
    records([]);
    renderWithQuery(<ShootButton />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText(VIDEO_GRID_MESSAGES.cannotShoot)).toBeInTheDocument();
  });
});
