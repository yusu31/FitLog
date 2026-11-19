import { render, screen } from '@testing-library/react';
import { PageTitle } from './app-shell';

// V-08・A13-4: 見出しはトークンの大きさ。右上にキャラを置く画面は、見出しの右を空ける
describe('PageTitle', () => {
  it('見出しの文字サイズはトークン（text-page-title）', () => {
    render(<PageTitle>なかま</PageTitle>);
    expect(screen.getByRole('heading', { level: 1 })).toHaveClass('text-page-title');
  });

  it('reserveCorner のときは右にキャラの幅ぶんの余白を取る', () => {
    render(<PageTitle reserveCorner>なかま</PageTitle>);
    expect(screen.getByRole('heading', { level: 1 })).toHaveClass('pr-24');
  });
});
