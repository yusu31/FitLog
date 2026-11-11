import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { STAMP_KEYS } from '@/lib/feed';
import { StampButton } from './stamp-button';

describe('StampButton', () => {
  it('どのスタンプにも絵文字が付き、文字は小さく残る', () => {
    const expected = { nice: '👍', fire: '🔥', clap: '👏', smile: '❤️', rest_slow: '😌', rest_again: '👋' };
    for (const key of Object.values(STAMP_KEYS).flat()) {
      const { container, unmount } = render(<StampButton stampKey={key} count={0} pressed={false} disabled={false} onClick={() => {}} />);
      expect(container.querySelector('[data-testid="stamp-emoji"]')?.textContent, key).toBe(expected[key]);
      expect(screen.getByRole('button').textContent).toContain(expected[key]);
      unmount();
    }
  });

  it('押した状態は aria-pressed と読み上げ名の数で伝える', () => {
    render(<StampButton stampKey="nice" count={2} pressed disabled={false} onClick={() => {}} />);
    const button = screen.getByRole('button', { name: 'ナイス 2' });
    expect(button).toHaveAttribute('aria-pressed', 'true');
  });

  it('数が0なら数字を出さず、押すと onClick が呼ばれる', async () => {
    const onClick = vi.fn();
    render(<StampButton stampKey="fire" count={0} pressed={false} disabled={false} onClick={onClick} />);
    const button = screen.getByRole('button', { name: 'すごい' });
    expect(button.textContent).toBe('🔥すごい');
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('disabled のときは押せない', async () => {
    const onClick = vi.fn();
    render(<StampButton stampKey="clap" count={0} pressed={false} disabled onClick={onClick} />);
    await userEvent.click(screen.getByRole('button', { name: 'おつかれ' }));
    expect(onClick).not.toHaveBeenCalled();
  });
});
