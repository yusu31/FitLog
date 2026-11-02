import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmDialog } from './confirm-dialog';

const renderDialog = (props: Partial<React.ComponentProps<typeof ConfirmDialog>> = {}) => {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(
    <ConfirmDialog
      open
      title="グループを出ますか？"
      description="出ると、仲間の記録が見えなくなります。"
      confirmLabel="出る"
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...props}
    />,
  );
  return { onConfirm, onCancel };
};

describe('ConfirmDialog（確認のダイアログ）', () => {
  it('開いていなければ何も出さない', () => {
    renderDialog({ open: false });
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('見出しと説明を名前・説明として持つ（読み上げで内容が分かる）', () => {
    renderDialog();
    const dialog = screen.getByRole('alertdialog', { name: 'グループを出ますか？' });
    expect(dialog).toHaveAccessibleDescription('出ると、仲間の記録が見えなくなります。');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('最初の操作は「やめる」に置く（うっかり Enter で実行しない）', () => {
    renderDialog();
    expect(screen.getByRole('button', { name: 'やめる' })).toHaveFocus();
  });

  it('実行ボタンで onConfirm、やめるで onCancel を呼ぶ', async () => {
    const user = userEvent.setup();
    const { onConfirm, onCancel } = renderDialog();
    await user.click(screen.getByRole('button', { name: '出る' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'やめる' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('Escape キーで onCancel を呼ぶ', async () => {
    const user = userEvent.setup();
    const { onCancel } = renderDialog();
    await user.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('外側の暗い部分を押すと onCancel を呼ぶ', async () => {
    const user = userEvent.setup();
    const { onCancel } = renderDialog();
    await user.click(screen.getByTestId('dialog-backdrop'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('送信中は実行ボタンを押せず、文言を変える', () => {
    renderDialog({ pending: true, pendingLabel: '出ています…' });
    expect(screen.getByRole('button', { name: '出ています…' })).toBeDisabled();
  });

  it('開いている間はうしろの画面を動かさず、閉じたら元に戻す', () => {
    const props = { title: 't', description: 'd', confirmLabel: 'ok', onConfirm: vi.fn(), onCancel: vi.fn() };
    const { rerender } = render(<ConfirmDialog open {...props} />);
    expect(document.body.style.overflow).toBe('hidden');
    rerender(<ConfirmDialog open={false} {...props} />);
    expect(document.body.style.overflow).toBe('');
  });

  it('Tab は2つのボタンの中でぐるぐる回り、ダイアログの外へ出ない', async () => {
    const user = userEvent.setup();
    renderDialog();
    expect(screen.getByRole('button', { name: 'やめる' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: '出る' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'やめる' })).toHaveFocus();
  });
});
