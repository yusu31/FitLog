import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VideoRecorder } from './video-recorder';

const issueVideoUpload = vi.fn();
vi.mock('@/lib/api/generated', () => ({ issueVideoUpload: (...a: unknown[]) => issueVideoUpload(...a) }));
const recordClip = vi.fn();
vi.mock('@/lib/video/record-video', () => ({ recordClip: (...a: unknown[]) => recordClip(...a) }));
const uploadToS3 = vi.fn();
vi.mock('@/lib/video/video-upload', async (orig) => ({
  ...(await orig<typeof import('@/lib/video/video-upload')>()),
  uploadToS3: (...a: unknown[]) => uploadToS3(...a),
}));

const stopTrack = vi.fn();
const UPLOAD = { url: 'https://s3.example/', fields: { key: 'k' } };

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('MediaRecorder', { isTypeSupported: (m: string) => m === 'video/mp4' });
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: stopTrack }] }) },
  });
  HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
});
afterEach(() => vi.unstubAllGlobals());

async function ready() {
  render(<VideoRecorder recordId="r1" onClose={() => {}} />);
  const shoot = await screen.findByRole('button', { name: '撮る' });
  await waitFor(() => expect(shoot).toBeEnabled());
  return shoot;
}

describe('VideoRecorder', () => {
  it('撮る → 申告（codecs なし）→ S3 へ送る → 保存した表示', async () => {
    recordClip.mockResolvedValue(new Blob(['abcd'], { type: 'video/mp4;codecs=avc1' }));
    issueVideoUpload.mockResolvedValue({ status: 201, data: { id: 'v1', upload: UPLOAD } });
    uploadToS3.mockResolvedValue(undefined);
    const shoot = await ready();
    await userEvent.click(shoot);
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('保存しました'));
    expect(issueVideoUpload).toHaveBeenCalledWith('r1', { contentType: 'video/mp4', sizeBytes: 4 });
    expect(uploadToS3).toHaveBeenCalledWith(UPLOAD, expect.any(Blob));
  });

  it('API が失敗したら責めない文言を出し、もう一度撮れる', async () => {
    recordClip.mockResolvedValue(new Blob(['abcd'], { type: 'video/mp4' }));
    issueVideoUpload.mockResolvedValue({ status: 503, data: {} });
    await userEvent.click(await ready());
    expect(await screen.findByRole('alert')).toHaveTextContent('送れませんでした');
    expect(uploadToS3).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'もう一度撮る' })).toBeEnabled();
  });

  it('カメラが使えないときは理由を出す', async () => {
    (navigator.mediaDevices.getUserMedia as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('denied'));
    render(<VideoRecorder recordId="r1" onClose={() => {}} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('カメラ');
  });

  it('閉じるとカメラを止める', async () => {
    const { unmount } = render(<VideoRecorder recordId="r1" onClose={() => {}} />);
    await screen.findByRole('button', { name: '撮る' });
    await act(async () => unmount());
    expect(stopTrack).toHaveBeenCalled();
  });
});
