import { render, screen } from '@testing-library/react';
import { EmptyState } from './empty-state';

describe('EmptyState（空の画面の共通部品）', () => {
  it('キャラ・タイトル・次の一手を出す', () => {
    render(<EmptyState title="まだ記録がありません" hint="「はじめる」から1つ記録しよう" action={<button type="button">はじめる</button>} pose="ready" />);
    expect(screen.getByText('まだ記録がありません')).toBeInTheDocument();
    expect(screen.getByText('「はじめる」から1つ記録しよう')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'はじめる' })).toBeInTheDocument();
    expect(screen.getByTestId('sprite')).toHaveAttribute('data-pose', 'ready');
  });

  it('キャラは飾りなので読み上げない（aria-hidden）', () => {
    render(<EmptyState title="空です" />);
    expect(screen.getByTestId('sprite')).toHaveAttribute('aria-hidden', 'true');
  });

  it('hint・action が無いときは出さない', () => {
    render(<EmptyState title="空です" />);
    expect(screen.getByTestId('empty-state').querySelectorAll('p')).toHaveLength(1);
  });

  it('character を渡すと Sprite の代わりに差し替わる', () => {
    render(<EmptyState title="空です" character={<span data-testid="mine" />} />);
    expect(screen.getByTestId('mine')).toBeInTheDocument();
    expect(screen.queryByTestId('sprite')).toBeNull();
  });

  it('as="li" で、リストの中に置ける', () => {
    render(
      <ul>
        <EmptyState as="li" title="空です" />
      </ul>,
    );
    expect(screen.getByRole('listitem')).toHaveTextContent('空です');
  });
});
