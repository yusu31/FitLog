import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Segmented } from './segmented';

const OPTIONS = [
  { value: 'a', label: '朝' },
  { value: 'b', label: '夜' },
] as const;

describe('Segmented', () => {
  it('選んでいるものだけ aria-checked になり、押すと onChange に値が渡る', async () => {
    const onChange = vi.fn();
    render(<Segmented legend="時間帯" options={OPTIONS} value="a" onChange={onChange} />);
    expect(screen.getByRole('radiogroup', { name: '時間帯' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '朝' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: '夜' })).toHaveAttribute('aria-checked', 'false');
    await userEvent.click(screen.getByRole('radio', { name: '夜' }));
    expect(onChange).toHaveBeenCalledWith('b');
  });
});
