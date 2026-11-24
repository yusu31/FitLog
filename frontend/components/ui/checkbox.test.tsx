import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Checkbox } from './checkbox';

describe('Checkbox（自前のチェックボックス）', () => {
  it('読み上げでは checkbox で、ラベルから名前が付く', () => {
    render(
      <label>
        <Checkbox />
        同意する
      </label>,
    );
    expect(screen.getByRole('checkbox', { name: '同意する' })).not.toBeChecked();
  });

  it('ラベルを押すとオン・オフが切り替わる', async () => {
    const user = userEvent.setup();
    render(
      <label>
        <Checkbox />
        同意する
      </label>,
    );
    await user.click(screen.getByText('同意する'));
    expect(screen.getByRole('checkbox')).toBeChecked();
    await user.click(screen.getByText('同意する'));
    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });

  it('キーボードの Space で切り替えられる', async () => {
    const user = userEvent.setup();
    render(<Checkbox aria-label="動画を撮る" />);
    await user.tab();
    expect(screen.getByRole('checkbox')).toHaveFocus();
    await user.keyboard(' ');
    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it('name を付けるとフォームの送信値に入る（オンのときだけ）', () => {
    render(
      <form data-testid="f">
        <Checkbox name="terms" aria-label="同意" />
      </form>,
    );
    const form = screen.getByTestId('f') as HTMLFormElement;
    expect(new FormData(form).get('terms')).toBeNull();
    fireEvent.click(screen.getByRole('checkbox'));
    expect(new FormData(form).get('terms')).toBe('on');
  });

  it('checked と onChange を渡す使い方（制御された状態）でも動く', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Checkbox aria-label="撮る" checked={false} onChange={onChange} />);
    await user.click(screen.getByRole('checkbox'));
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
