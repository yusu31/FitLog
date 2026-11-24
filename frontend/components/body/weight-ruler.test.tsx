import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WeightRuler } from './weight-ruler';

describe('WeightRuler（体重のものさし。L11）', () => {
  it('1kg ごとに目盛りの数字を出す（20〜300 の281個）', () => {
    render(<WeightRuler value={60} onChange={() => {}} />);
    const labels = screen.getAllByTestId('ruler-label').map((e) => e.textContent);
    expect(labels).toHaveLength(281);
    expect(labels.slice(0, 3)).toEqual(['20', '21', '22']);
    expect(labels.at(-1)).toBe('300');
  });

  it('lb のときは lb の数で目盛りを出し、値も lb で読み上げる（60kg は 132.3lb）', () => {
    render(<WeightRuler value={60} onChange={() => {}} unit="lb" />);
    const labels = screen.getAllByTestId('ruler-label').map((e) => e.textContent);
    expect(labels[0]).toBe('45');
    expect(labels.at(-1)).toBe('661');
    const slider = screen.getByRole('slider', { name: '体重（lb）' });
    expect(slider).toHaveAttribute('aria-valuenow', '132.3');
    expect(slider).toHaveAttribute('aria-valuetext', '132.3lb');
  });

  it('kg の矢印キーは 0.1kg・PageUp は 1kg 動かし、onChange には kg が渡る', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<WeightRuler value={60} onChange={onChange} />);
    screen.getByRole('slider').focus();
    await user.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenLastCalledWith(60.1);
    await user.keyboard('{PageUp}');
    expect(onChange).toHaveBeenLastCalledWith(61);
  });

  it('lb で 1lb 動かすと、kg（0.1 刻み）に直した値が onChange に渡る', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<WeightRuler value={60} onChange={onChange} unit="lb" />);
    screen.getByRole('slider').focus();
    await user.keyboard('{PageUp}');
    // 133.3lb → 60.5kg（133.3 × 0.45359237 = 60.46）
    expect(onChange).toHaveBeenLastCalledWith(60.5);
  });

  it('スクロールで動かすと、その位置の値が onChange に渡る', () => {
    const onChange = vi.fn();
    render(<WeightRuler value={60} onChange={onChange} />);
    const slider = screen.getByRole('slider');
    slider.scrollLeft = (61 - 20) * 10 * 10; // 61.0kg の位置（0.1kg ごとに 10px）
    fireEvent.scroll(slider);
    expect(onChange).toHaveBeenCalledWith(61);
  });
});
