import { render, screen } from '@testing-library/react';
import Home from './page';

describe('Home（今日タブの仮の画面）', () => {
  // T-FE-01: アプリ名が見出しで見える
  it('アプリ名 FitLog を見出しで表示する', () => {
    render(<Home />);
    expect(screen.getByRole('heading', { level: 1, name: 'FitLog' })).toBeInTheDocument();
  });

  // T-FE-02: 何のアプリかを一文で言う（雛形の Next.js のロゴやリンクが残っていない）
  it('一文の説明を表示し、雛形の宣伝（Next.js のロゴ）は出さない', () => {
    render(<Home />);
    expect(screen.getByText('少人数で使う、筋トレとランの記録アプリ')).toBeInTheDocument();
    expect(screen.queryByAltText('Next.js logo')).not.toBeInTheDocument();
  });
});
