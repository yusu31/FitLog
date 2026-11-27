import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VideoRecorder } from './video-recorder';

const issueVideoUpload = vi.fn();
const listRecords = vi.fn();
const createRecord = vi.fn();
const deleteRecord = vi.fn();
const updateRecordMemo = vi.fn();
vi.mock('@/lib/api/generated', () => ({
  issueVideoUpload: (...a: unknown[]) => issueVideoUpload(...a),
  listRecords: (...a: unknown[]) => listRecords(...a),
  createRecord: (...a: unknown[]) => createRecord(...a),
  deleteRecord: (...a: unknown[]) => deleteRecord(...a),
  updateRecordMemo: (...a: unknown[]) => updateRecordMemo(...a),
}));
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
  // 見直し用の動画の URL（jsdom の既定は Blob を読めずに落ちる）
  URL.createObjectURL = vi.fn(() => 'blob:clip');
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => vi.unstubAllGlobals());

async function ready() {
  render(<VideoRecorder recordId="r1" onClose={() => {}} />);
  const shoot = await screen.findByRole('button', { name: '撮る' });
  await waitFor(() => expect(shoot).toBeEnabled());
  return shoot;
}

describe('VideoRecorder', () => {
  it('撮る → 見直し → 送る → 申告（codecs なし）→ S3 へ送る → 保存した表示（付け先を渡したときはその記録に付ける）', async () => {
    recordClip.mockResolvedValue(new Blob(['abcd'], { type: 'video/mp4;codecs=avc1' }));
    issueVideoUpload.mockResolvedValue({ status: 201, data: { id: 'v1', upload: UPLOAD } });
    uploadToS3.mockResolvedValue(undefined);
    const shoot = await ready();
    await userEvent.click(shoot);
    // 撮ったら、送る前に見直す（ひとこと・撮り直す・送る）。まだ何も送っていない
    const send = await screen.findByRole('button', { name: '送る' });
    expect(screen.getByRole('status')).toHaveTextContent('この記録に付けます');
    expect(screen.getByRole('button', { name: '撮り直す' })).toBeEnabled();
    expect(screen.getByLabelText(/ひとこと/)).toBeInTheDocument();
    expect(issueVideoUpload).not.toHaveBeenCalled();
    await userEvent.click(send);
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('保存しました'));
    expect(issueVideoUpload).toHaveBeenCalledWith('r1', { contentType: 'video/mp4', sizeBytes: 4 });
    expect(uploadToS3).toHaveBeenCalledWith(UPLOAD, expect.any(Blob));
    expect(updateRecordMemo).not.toHaveBeenCalled(); // ひとこと無しなら記録は書き換えない
    expect(listRecords).not.toHaveBeenCalled(); // 付け先を渡したので、自動で決めない
  });

  it('ひとこと（50字まで）を書いて送ると、その記録にひとことを保存してから動画を置く', async () => {
    recordClip.mockResolvedValue(new Blob(['abcd'], { type: 'video/mp4' }));
    updateRecordMemo.mockResolvedValue({ status: 200, data: {} });
    issueVideoUpload.mockResolvedValue({ status: 201, data: { id: 'v1', upload: UPLOAD } });
    uploadToS3.mockResolvedValue(undefined);
    await userEvent.click(await ready());
    const input = await screen.findByLabelText(/ひとこと/);
    await userEvent.type(input, '  いい汗  ');
    await userEvent.click(screen.getByRole('button', { name: '送る' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('保存しました'));
    expect(updateRecordMemo).toHaveBeenCalledWith('r1', { caption: 'いい汗' });
  });

  it('ひとこと欄は50字で止まる（絵文字も1字。数が見える）', async () => {
    recordClip.mockResolvedValue(new Blob(['abcd'], { type: 'video/mp4' }));
    await userEvent.click(await ready());
    const input = (await screen.findByLabelText(/ひとこと/)) as HTMLInputElement;
    await userEvent.click(input);
    await userEvent.paste('😀'.repeat(60));
    expect(Array.from(input.value)).toHaveLength(50);
    expect(screen.getByText('50/50')).toBeInTheDocument();
  });

  it('「撮り直す」で、送らずにカメラの画面にもどる', async () => {
    recordClip.mockResolvedValue(new Blob(['abcd'], { type: 'video/mp4' }));
    await userEvent.click(await ready());
    await userEvent.click(await screen.findByRole('button', { name: '撮り直す' }));
    expect(await screen.findByRole('button', { name: '撮る' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: '送る' })).not.toBeInTheDocument();
    expect(issueVideoUpload).not.toHaveBeenCalled();
  });

  it('API が失敗したら責めない文言を出し、見直しの画面のまま、もう一度「送る」で送れる', async () => {
    recordClip.mockResolvedValue(new Blob(['abcd'], { type: 'video/mp4' }));
    issueVideoUpload.mockResolvedValue({ status: 503, data: {} });
    await userEvent.click(await ready());
    await userEvent.click(await screen.findByRole('button', { name: '送る' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('送れませんでした');
    expect(uploadToS3).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: '送る' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '撮り直す' })).toBeEnabled();
  });

  // 付け先は自動（recordId を渡さない）。優先順位: ①記録中の筋トレ → ②今日の記録のうち動画がまだ無い一番新しいもの → ③投稿
  describe('付け先が自動のとき', () => {
    const rec = (id: string, over: Record<string, unknown> = {}) => ({ id, kind: 'workout', recordedAt: '2026-11-27T01:00:00.000Z', localDate: '2026-11-27', ...over });
    const list = (items: unknown[]) => listRecords.mockResolvedValue({ status: 200, data: { items, nextCursor: null } });

    async function shootAuto() {
      recordClip.mockResolvedValue(new Blob(['abcd'], { type: 'video/mp4' }));
      issueVideoUpload.mockResolvedValue({ status: 201, data: { id: 'v1', upload: UPLOAD } });
      uploadToS3.mockResolvedValue(undefined);
      render(<VideoRecorder onClose={() => {}} />);
      const shoot = await screen.findByRole('button', { name: '撮る' });
      await waitFor(() => expect(shoot).toBeEnabled());
      await userEvent.click(shoot);
    }

    it('①記録中の筋トレがあれば、それに付ける（より新しい記録があっても）', async () => {
      list([rec('run1', { kind: 'run', recordedAt: '2026-11-27T05:00:00.000Z' }), rec('w1', { active: true })]);
      await shootAuto();
      await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('筋トレに付けます'));
      await userEvent.click(screen.getByRole('button', { name: '送る' }));
      await waitFor(() => expect(issueVideoUpload).toHaveBeenCalledWith('w1', expect.anything()));
      expect(createRecord).not.toHaveBeenCalled();
    });

    it('②記録中でなければ、今日の記録のうち動画がまだ無い一番新しいものに付ける。動画が付いている記録・あとから記録はとばす', async () => {
      list([rec('withVideo', { kind: 'run', videoId: 'v9' }), rec('late', { late: true }), rec('run2', { kind: 'run' }), rec('w1')]);
      await shootAuto();
      await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('ランに付けます'));
      await userEvent.click(screen.getByRole('button', { name: '送る' }));
      await waitFor(() => expect(issueVideoUpload).toHaveBeenCalledWith('run2', expect.anything()));
    });

    it('おやすみの記録にも付けられる（すべての日に動画）', async () => {
      list([rec('rest1', { kind: 'rest' })]);
      await shootAuto();
      await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('おやすみに付けます'));
    });

    it('③付け先が無ければ「投稿」を新しく作る（ひとこと付き）。投稿を作ってから動画を置く', async () => {
      list([rec('done', { videoId: 'v1' })]);
      createRecord.mockResolvedValue({ status: 201, data: {} });
      await shootAuto();
      await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('投稿として送ります'));
      await userEvent.type(screen.getByLabelText(/ひとこと/), 'ジム前');
      await userEvent.click(screen.getByRole('button', { name: '送る' }));
      await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('保存しました'));
      expect(createRecord).toHaveBeenCalledWith(expect.objectContaining({ kind: 'post', caption: 'ジム前', id: expect.any(String), recordedAt: expect.any(String) }));
      const postId = createRecord.mock.calls[0][0].id as string;
      expect(issueVideoUpload).toHaveBeenCalledWith(postId, expect.anything());
      expect(deleteRecord).not.toHaveBeenCalled();
    });

    it('投稿を作ったあとで動画が置けなかったら、中身の無い投稿を消して、見直しにもどる', async () => {
      list([]);
      createRecord.mockResolvedValue({ status: 201, data: {} });
      deleteRecord.mockResolvedValue({ status: 204, data: undefined });
      await shootAuto();
      issueVideoUpload.mockResolvedValue({ status: 503, data: {} });
      await userEvent.click(await screen.findByRole('button', { name: '送る' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('送れませんでした');
      const postId = createRecord.mock.calls[0][0].id as string;
      expect(deleteRecord).toHaveBeenCalledWith(postId);
      expect(screen.getByRole('button', { name: '送る' })).toBeEnabled();
    });

    it('付け先を決められなくても（一覧が取れない）、撮った動画は残り、送るときにもう一度決める', async () => {
      listRecords.mockResolvedValueOnce({ status: 503, data: {} });
      list([rec('w1', { active: true })]);
      await shootAuto();
      await userEvent.click(await screen.findByRole('button', { name: '送る' }));
      await waitFor(() => expect(issueVideoUpload).toHaveBeenCalledWith('w1', expect.anything()));
    });
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

  it('「もう一度ためす」でカメラを取り直し、使えれば撮れる', async () => {
    const get = navigator.mediaDevices.getUserMedia as ReturnType<typeof vi.fn>;
    get.mockRejectedValueOnce(new Error('denied'));
    render(<VideoRecorder recordId="r1" onClose={() => {}} />);
    await userEvent.click(await screen.findByRole('button', { name: 'もう一度ためす' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '撮る' })).toBeEnabled());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('ブラウザではアドレス欄、ホーム画面から開いたときはスマホの設定を案内する', async () => {
    (navigator.mediaDevices.getUserMedia as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('denied'));
    const first = render(<VideoRecorder recordId="r1" onClose={() => {}} />);
    await screen.findByRole('alert');
    expect(screen.getByText(/アドレス欄/)).toBeInTheDocument();
    first.unmount();
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q === '(display-mode: standalone)' }));
    render(<VideoRecorder recordId="r1" onClose={() => {}} />);
    await screen.findByRole('alert');
    expect(screen.queryByText(/アドレス欄/)).not.toBeInTheDocument();
    expect(screen.getByText('スマホの「設定」をひらく')).toBeInTheDocument();
  });

  // 「できた」で休憩の帯（z-40）が自動で出るので、撮影画面はそれより前に無いとボタンが隠れる
  it('休憩の帯より前に出る（z-50）', async () => {
    await ready();
    expect(screen.getByRole('dialog', { name: '2秒ラストレップを撮る' })).toHaveClass('z-50');
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
