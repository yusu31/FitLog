import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { installFakeApi, renderWithQuery } from '@/lib/test/fake-api';
import { RecordVideoDelete } from './record-video-delete';

const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));

afterEach(() => {
  replace.mockReset();
  vi.unstubAllGlobals();
});

const deleted = () => (fetch as ReturnType<typeof vi.fn>).mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === 'DELETE');

// 動画だけ消す（PR 4）。投稿は動画を消すと投稿ごと消える。ほかの種類は動画だけ消えて記録は残る
describe('RecordVideoDelete（動画だけ消す）', () => {
  it('確認の文: 投稿は「投稿ごと消える」、ほかは「動画だけ消えて記録は残る」', async () => {
    installFakeApi({});
    const { unmount } = renderWithQuery(<RecordVideoDelete recordId="r1" isPost />);
    await userEvent.click(screen.getByRole('button', { name: '動画だけ 消す' }));
    expect(screen.getByRole('alertdialog')).toHaveTextContent('投稿ごと消えます');
    unmount();
    renderWithQuery(<RecordVideoDelete recordId="r1" isPost={false} />);
    await userEvent.click(screen.getByRole('button', { name: '動画だけ 消す' }));
    expect(screen.getByRole('alertdialog')).toHaveTextContent('動画だけ消えます。記録は残ります');
  });

  it('やめるを押すと、何も消さずに閉じる', async () => {
    installFakeApi({});
    renderWithQuery(<RecordVideoDelete recordId="r1" isPost={false} />);
    await userEvent.click(screen.getByRole('button', { name: '動画だけ 消す' }));
    await userEvent.click(screen.getByRole('button', { name: 'やめる' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(deleted()).toHaveLength(0);
  });

  it('投稿の動画を消すと（recordDeleted=true）、投稿ごと消えたので「自分」へ移る', async () => {
    installFakeApi({ 'DELETE /api/records/r1/video': { status: 200, body: { recordDeleted: true } } });
    renderWithQuery(<RecordVideoDelete recordId="r1" isPost />);
    await userEvent.click(screen.getByRole('button', { name: '動画だけ 消す' }));
    await userEvent.click(screen.getByRole('button', { name: '消す' }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/me'));
    expect(deleted()).toHaveLength(1);
  });

  it('筋トレなどの動画を消すと（recordDeleted=false）、移らずにその画面のまま', async () => {
    installFakeApi({ 'DELETE /api/records/r1/video': { status: 200, body: { recordDeleted: false } } });
    renderWithQuery(<RecordVideoDelete recordId="r1" isPost={false} />);
    await userEvent.click(screen.getByRole('button', { name: '動画だけ 消す' }));
    await userEvent.click(screen.getByRole('button', { name: '消す' }));
    await waitFor(() => expect(deleted()).toHaveLength(1));
    expect(replace).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('消せなかったら責めない文言を出して、ダイアログを閉じる', async () => {
    installFakeApi({ 'DELETE /api/records/r1/video': { status: 503, body: {} } });
    renderWithQuery(<RecordVideoDelete recordId="r1" isPost={false} />);
    await userEvent.click(screen.getByRole('button', { name: '動画だけ 消す' }));
    await userEvent.click(screen.getByRole('button', { name: '消す' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('消せませんでした');
    expect(replace).not.toHaveBeenCalled();
  });
});
