import { fireEvent, screen } from '@testing-library/react';
import { DETAIL_MESSAGES } from '@/lib/messages';
import { installFakeApi, renderWithQuery } from '@/lib/test/fake-api';
import { VideoPlayer } from './video-player';

const URL_API = '/api/videos/v1/url';

describe('VideoPlayer（S-21 の2秒動画）', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('署名付き URL をもらって、動画を出す（自動再生しない・音なし・ループ）', async () => {
    installFakeApi({ [URL_API]: { status: 200, body: { url: 'https://s3.example/videos/r1?sig=x', expiresInSeconds: 300 } } });
    const { container } = renderWithQuery(<VideoPlayer videoId="v1" />);
    const video = await screen.findByLabelText(DETAIL_MESSAGES.videoLabel);
    expect(video).toHaveAttribute('src', 'https://s3.example/videos/r1?sig=x');
    expect(container.querySelector('video')).toHaveProperty('muted', true);
    expect(video).toHaveAttribute('controls');
    expect(video).not.toHaveAttribute('autoplay');
  });

  it('仲間に見える期限（その週の日曜 24:00）が過ぎていたら、責めずに伝える（403）', async () => {
    installFakeApi({ [URL_API]: { status: 403, body: { code: 'VIDEO_EXPIRED', message: 'x', details: null } } });
    renderWithQuery(<VideoPlayer videoId="v1" />);
    expect(await screen.findByText(DETAIL_MESSAGES.videoExpired)).toBeInTheDocument();
    expect(screen.queryByLabelText(DETAIL_MESSAGES.videoLabel)).not.toBeInTheDocument();
  });

  it('URL を取れなかったら、動画の枠だけ静かに出さない案内にする', async () => {
    installFakeApi({ [URL_API]: { status: 404, body: { code: 'VIDEO_NOT_FOUND', message: 'x', details: null } } });
    renderWithQuery(<VideoPlayer videoId="v1" />);
    expect(await screen.findByText(DETAIL_MESSAGES.videoUnavailable)).toBeInTheDocument();
  });

  it('再生できない形式・置けていない動画は、再生できなかったと伝える', async () => {
    installFakeApi({ [URL_API]: { status: 200, body: { url: 'https://s3.example/v', expiresInSeconds: 300 } } });
    renderWithQuery(<VideoPlayer videoId="v1" />);
    const video = await screen.findByLabelText(DETAIL_MESSAGES.videoLabel);
    fireEvent.error(video);
    expect(await screen.findByText(DETAIL_MESSAGES.videoUnavailable)).toBeInTheDocument();
  });
});
