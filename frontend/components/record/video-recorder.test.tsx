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

  it('カメラが使えないときは、直し方を3つの手順で出し、「あとで撮る」で閉じられる', async () => {
    (navigator.mediaDevices.getUserMedia as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('denied'));
    const onClose = vi.fn();
    render(<VideoRecorder recordId="r1" onClose={onClose} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('カメラを使えませんでした');
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.queryByRole('button', { name: '撮る' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'あとで撮る' }));
    expect(onClose).toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'やめる' })).not.toBeInTheDocument();
  });

  it('閉じるとカメラを止める', async () => {
    const { unmount } = render(<VideoRecorder recordId="r1" onClose={() => {}} />);
    await screen.findByRole('button', { name: '撮る' });
    await act(async () => unmount());
    expect(stopTrack).toHaveBeenCalled();
  });

  // L4: 準備中は進みと「やめる」を出し、8秒来なければ直し方へ移る
  describe('カメラの準備が終わらないとき', () => {
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
    });
    afterEach(() => vi.useRealTimers());

    it('準備中は進み表示と「やめる」を出し、押すと閉じられる', async () => {
      (navigator.mediaDevices.getUserMedia as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));
      const onClose = vi.fn();
      render(<VideoRecorder recordId="r1" onClose={onClose} />);
      expect(screen.getByRole('status')).toHaveTextContent('カメラを準備しています（0秒）');
      expect(screen.getByRole('progressbar', { name: 'カメラの準備' })).toHaveAttribute('aria-valuenow', '0');
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });
      expect(screen.getByRole('status')).toHaveTextContent('（3秒）');
      await userEvent.click(screen.getByRole('button', { name: 'やめる' }));
      expect(onClose).toHaveBeenCalled();
    });

    it('8秒たってもカメラが来なければ、直し方（3つの手順）に移り、あとで来たカメラは止める', async () => {
      let resolve!: (s: unknown) => void;
      (navigator.mediaDevices.getUserMedia as ReturnType<typeof vi.fn>).mockReturnValue(new Promise((r) => (resolve = r)));
      render(<VideoRecorder recordId="r1" onClose={() => {}} />);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(7900);
      });
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(200);
      });
      expect(screen.getByRole('alert')).toHaveTextContent('カメラを使えませんでした');
      expect(screen.getAllByRole('listitem')).toHaveLength(3);
      expect(screen.getByRole('button', { name: 'あとで撮る' })).toBeInTheDocument();
      await act(async () => {
        resolve({ getTracks: () => [{ stop: stopTrack }] });
      });
      expect(stopTrack).toHaveBeenCalled();
      expect(screen.queryByRole('button', { name: '撮る' })).not.toBeInTheDocument();
    });

    it('カメラが来れば、8秒を過ぎても直し方に移らない', async () => {
      render(<VideoRecorder recordId="r1" onClose={() => {}} />);
      await screen.findByRole('button', { name: '撮る' });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(9000);
      });
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });
});
