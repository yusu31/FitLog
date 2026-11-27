import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithQuery } from '@/lib/test/fake-api';
import { VIDEO_GRID_MESSAGES } from './messages';
import { ShootButton } from './shoot-button';

let capable = true;
vi.mock('@/components/record/video-recorder', () => ({ canRecordVideo: () => capable }));
// 撮影の画面そのもの（付け先の自動決定を含む）は video-recorder のテストで見る。ここでは「その場で開く」ことだけ
vi.mock('@/components/record/auto-video-recorder', () => ({
  AutoVideoRecorder: ({ onClose }: { onClose: () => void }) => <button type="button" onClick={onClose}>撮影の画面</button>,
}));

beforeEach(() => {
  capable = true;
});

describe('ShootButton（鍵から撮りにいく。#438）', () => {
  it('押すと、画面を移らずその場で撮影が開き（付け先は自動）、閉じられる。筋トレの記録が無くても撮れる', async () => {
    renderWithQuery(<ShootButton />);
    await userEvent.click(await screen.findByRole('button', { name: VIDEO_GRID_MESSAGES.shoot }));
    await userEvent.click(screen.getByRole('button', { name: '撮影の画面' }));
    expect(screen.queryByRole('button', { name: '撮影の画面' })).not.toBeInTheDocument();
  });

  it('撮れない端末では、ボタンを出さず理由だけ', () => {
    capable = false;
    renderWithQuery(<ShootButton />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText(VIDEO_GRID_MESSAGES.cannotShoot)).toBeInTheDocument();
  });
});
