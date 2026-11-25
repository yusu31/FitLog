import { fireEvent, screen } from '@testing-library/react';
import { installFakeApi, renderWithQuery } from '@/lib/test/fake-api';
import { VIDEO_GRID_MESSAGES } from './messages';
import { MyVideoGrid } from './my-video-grid';
import { WeekVideoStrip } from './week-video-strip';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const AVATAR = { body: 'A', hair: 1, hairColor: 'brown', shirtColor: 'teal', pantsColor: 'navy' };
const url = (id: string) => ({ [`/api/videos/${id}/url`]: { status: 200, body: { url: `https://s3.example/videos/${id}?sig=x`, expiresInSeconds: 300 } } });
const week = (unlocked: boolean, items: unknown[]) => ({ '/api/videos/week': { status: 200, body: { weekStart: '2026-11-16', unlocked, items } } });
const wItem = (id: string, name: string, mine = false) => ({
  id,
  recordId: `r-${id}`,
  recordedAt: '2026-11-18T01:00:00.000Z',
  visibleUntil: '2026-11-22T15:00:00.000Z',
  mine,
  author: { id: `u-${id}`, name, avatar: AVATAR },
});
const mItem = (id: string, localDate: string) => ({ id, recordId: `r-${id}`, recordedAt: `${localDate}T01:00:00.000Z`, localDate, visibleUntil: '2026-11-22T15:00:00.000Z' });

afterEach(() => {
  vi.unstubAllGlobals();
  push.mockReset();
});

describe('WeekVideoStrip（仲間タブの今週の2秒動画。A14-2）', () => {
  it('自分が今週撮っていれば（unlocked）、仲間の動画も開ける。選ぶと撮った人の記録の詳細へ', async () => {
    installFakeApi({ ...week(true, [wItem('v1', 'はなこ'), wItem('v2', 'たろう', true)]), ...url('v1'), ...url('v2') });
    renderWithQuery(<WeekVideoStrip />);
    expect(await screen.findByRole('heading', { name: VIDEO_GRID_MESSAGES.stripLabel })).toBeInTheDocument();
    fireEvent.click(await screen.findByLabelText(VIDEO_GRID_MESSAGES.open('はなこ')));
    expect(push).toHaveBeenCalledWith('/record-detail?id=r-v1&by=u-v1');
    fireEvent.click(screen.getByLabelText(VIDEO_GRID_MESSAGES.open('自分')));
    expect(push).toHaveBeenCalledWith('/record-detail?id=r-v2&from=me');
  });

  it('今週まだ撮っていないとき（unlocked でない）、仲間の動画はぼかして「1本撮ると見られます」。動画の URL は取りに行かない', async () => {
    installFakeApi(week(false, [wItem('v1', 'はなこ')]));
    renderWithQuery(<WeekVideoStrip />);
    expect(await screen.findByRole('img', { name: `はなこ: ${VIDEO_GRID_MESSAGES.locked}` })).toBeInTheDocument();
    expect(screen.queryByLabelText(VIDEO_GRID_MESSAGES.open('はなこ'))).not.toBeInTheDocument();
  });

  it('動画が1本もない週・読み込み中・失敗のときは、何も出さない', async () => {
    for (const reply of [week(true, []), { '/api/videos/week': { status: 500, body: { code: 'X', message: 'x' } } }]) {
      installFakeApi(reply);
      const { container, unmount } = renderWithQuery(<WeekVideoStrip />);
      expect(container).toBeEmptyDOMElement(); // 読み込み中
      await vi.waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalled());
      await new Promise((r) => setTimeout(r, 20));
      expect(container).toBeEmptyDOMElement();
      unmount();
    }
  });
});

describe('MyVideoGrid（自分の過去の動画のグリッド。A04-10）', () => {
  it('自分の動画は条件なしで開ける。日付の札つき。選ぶと自分の記録の詳細へ', async () => {
    installFakeApi({ '/api/videos/mine': { status: 200, body: { items: [mItem('v1', '2026-11-02')], nextCursor: null } }, ...url('v1') });
    renderWithQuery(<MyVideoGrid />);
    expect(await screen.findByRole('heading', { name: VIDEO_GRID_MESSAGES.gridLabel })).toBeInTheDocument();
    fireEvent.click(await screen.findByLabelText(VIDEO_GRID_MESSAGES.open('11/2')));
    expect(push).toHaveBeenCalledWith('/record-detail?id=r-v1&from=me');
  });

  it('続きがあるときは「もっと見る」で nextCursor を渡して読む', async () => {
    installFakeApi({
      '/api/videos/mine': { status: 200, body: { items: [mItem('v1', '2026-11-02')], nextCursor: 'c1' } },
      '/api/videos/mine?cursor=c1': { status: 200, body: { items: [mItem('v0', '2026-10-30')], nextCursor: null } },
      ...url('v1'),
      ...url('v0'),
    });
    renderWithQuery(<MyVideoGrid />);
    fireEvent.click(await screen.findByRole('button', { name: VIDEO_GRID_MESSAGES.loadMore }));
    expect(await screen.findByLabelText(VIDEO_GRID_MESSAGES.open('10/30'))).toBeInTheDocument();
  });

  it('空・失敗のときのやさしい文言', async () => {
    installFakeApi({ '/api/videos/mine': { status: 200, body: { items: [], nextCursor: null } } });
    const { unmount } = renderWithQuery(<MyVideoGrid />);
    expect(await screen.findByText(VIDEO_GRID_MESSAGES.emptyGrid)).toBeInTheDocument();
    unmount();
    installFakeApi({ '/api/videos/mine': { status: 500, body: { code: 'X', message: 'x' } } });
    renderWithQuery(<MyVideoGrid />);
    expect(await screen.findByRole('alert')).toHaveTextContent(VIDEO_GRID_MESSAGES.loadFailed);
  });
});
