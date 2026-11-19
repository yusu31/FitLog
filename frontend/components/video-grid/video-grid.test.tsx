import { fireEvent, screen, within } from '@testing-library/react';
import { calls, installFakeApi, renderWithQuery } from '@/lib/test/fake-api';
import { VIDEO_GRID_MESSAGES } from './messages';
import { VideoGrid, type VideoGridItem } from './video-grid';

const ok = (id: string) => ({ [`/api/videos/${id}/url`]: { status: 200, body: { url: `https://s3.example/videos/${id}?sig=x`, expiresInSeconds: 300 } } });
const items: VideoGridItem[] = [
  { id: 'v1', label: 'たろう' },
  { id: 'v2', label: '自分', mine: true },
];

describe('VideoGrid（A14-2 動画のサムネの並び）', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('見られるとき（locked でない）は、動画ごとに署名付き URL をもらい、先頭の1コマをサムネにする（音なし・自動再生しない）', async () => {
    installFakeApi({ ...ok('v1'), ...ok('v2') });
    const { container } = renderWithQuery(<VideoGrid items={items} layout="strip" />);
    await vi.waitFor(() => expect(container.querySelectorAll('video')).toHaveLength(2));
    const video = container.querySelector('video')!;
    expect(video.getAttribute('src')).toBe('https://s3.example/videos/v1?sig=x#t=0.1');
    expect(video).toHaveProperty('muted', true);
    expect(video).not.toHaveAttribute('autoplay');
    expect(screen.getByLabelText(VIDEO_GRID_MESSAGES.stripLabel)).toBeInTheDocument();
  });

  it('locked のとき、仲間の動画はぼかして「1本撮ると見られます」を出し、URL を取りに行かない。自分の動画（mine）は見られる', async () => {
    installFakeApi({ ...ok('v2') });
    const { container } = renderWithQuery(<VideoGrid items={items} layout="strip" locked />);
    expect(screen.getByRole('img', { name: `たろう: ${VIDEO_GRID_MESSAGES.locked}` })).toBeInTheDocument();
    expect(screen.queryByLabelText(VIDEO_GRID_MESSAGES.open('たろう'))).not.toBeInTheDocument();
    expect(screen.getByLabelText(VIDEO_GRID_MESSAGES.open('自分'))).toBeInTheDocument();
    await vi.waitFor(() => expect(container.querySelectorAll('video')).toHaveLength(1));
    // 仲間の動画の URL は呼ばれていない（条件外では URL を出さない）
    expect(calls.some((c) => c.includes('/videos/v1/'))).toBe(false);
  });

  it('タップすると、その動画の id で onSelect が呼ばれる', async () => {
    installFakeApi({ ...ok('v1'), ...ok('v2') });
    const onSelect = vi.fn();
    renderWithQuery(<VideoGrid items={items} layout="grid" onSelect={onSelect} />);
    fireEvent.click(screen.getByLabelText(VIDEO_GRID_MESSAGES.open('たろう')));
    expect(onSelect).toHaveBeenCalledWith('v1');
    expect(screen.getByLabelText(VIDEO_GRID_MESSAGES.gridLabel)).toBeInTheDocument();
  });

  it('URL を取れなかった（403・404）動画は、枠だけ「再生できませんでした」と出す', async () => {
    installFakeApi({ '/api/videos/v1/url': { status: 403, body: { code: 'VIDEO_LOCKED', message: 'x', details: null } } });
    renderWithQuery(<VideoGrid items={[items[0]!]} layout="grid" />);
    const tile = screen.getByLabelText(VIDEO_GRID_MESSAGES.open('たろう'));
    expect(await within(tile).findByText(VIDEO_GRID_MESSAGES.unavailable)).toBeInTheDocument();
    expect(tile.querySelector('video')).toBeNull();
  });

  it('再生できない形式（読み込みエラー）のサムネも、責めずに伝える', async () => {
    installFakeApi({ ...ok('v1') });
    const { container } = renderWithQuery(<VideoGrid items={[items[0]!]} layout="grid" />);
    await vi.waitFor(() => expect(container.querySelector('video')).not.toBeNull());
    fireEvent.error(container.querySelector('video')!);
    expect(await screen.findByText(VIDEO_GRID_MESSAGES.unavailable)).toBeInTheDocument();
  });

  it('0本のときは、並びごとの空の案内を出す', () => {
    installFakeApi({});
    const { unmount } = renderWithQuery(<VideoGrid items={[]} layout="strip" />);
    expect(screen.getByText(VIDEO_GRID_MESSAGES.emptyStrip)).toBeInTheDocument();
    unmount();
    renderWithQuery(<VideoGrid items={[]} layout="grid" />);
    expect(screen.getByText(VIDEO_GRID_MESSAGES.emptyGrid)).toBeInTheDocument();
  });
});
