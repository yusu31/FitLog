import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InfoTip } from './info-tip';

describe('InfoTip（「?」で開く説明）', () => {
  it('最初は閉じていて、説明は見えない。ボタンは aria-expanded=false', () => {
    render(<InfoTip label="記録の説明">説明のぶんしょう</InfoTip>);
    const b = screen.getByRole('button', { name: '記録の説明' });
    expect(b).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('説明のぶんしょう')).not.toBeVisible();
  });

  it('押すと開いて説明が見え、もう一度押すと閉じる', async () => {
    const user = userEvent.setup();
    render(<InfoTip label="記録の説明">説明のぶんしょう</InfoTip>);
    const b = screen.getByRole('button', { name: '記録の説明' });
    await user.click(b);
    expect(b).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('説明のぶんしょう')).toBeVisible();
    await user.click(b);
    expect(screen.getByText('説明のぶんしょう')).not.toBeVisible();
  });

  it('キーボード（Tab で届き、Enter で開き、Esc で閉じる）で操作できる', async () => {
    const user = userEvent.setup();
    render(<InfoTip label="記録の説明">説明のぶんしょう</InfoTip>);
    await user.tab();
    const b = screen.getByRole('button', { name: '記録の説明' });
    expect(b).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(screen.getByText('説明のぶんしょう')).toBeVisible();
    await user.keyboard('{Escape}');
    expect(b).toHaveAttribute('aria-expanded', 'false');
  });

  it('aria-controls が説明の入れ物を指す', () => {
    render(<InfoTip label="記録の説明">説明のぶんしょう</InfoTip>);
    const id = screen.getByRole('button', { name: '記録の説明' }).getAttribute('aria-controls');
    expect(id).toBeTruthy();
    expect(document.getElementById(id!)).toHaveTextContent('説明のぶんしょう');
  });

  it('ボタンは押せる大きさ（44px 以上）', () => {
    render(<InfoTip label="記録の説明">x</InfoTip>);
    expect(screen.getByRole('button', { name: '記録の説明' })).toHaveClass('size-11');
  });
});
