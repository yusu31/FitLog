import { render, screen } from '@testing-library/react';
import { ThickButton } from './thick-button';

// A13-3: ボタンの型は主・副・文字リンクの3つ
describe('ThickButton の型（variant）', () => {
  it('主（primary）は濃ティールの厚みボタン', () => {
    render(<ThickButton variant="primary">保存</ThickButton>);
    const b = screen.getByRole('button', { name: '保存' });
    expect(b).toHaveClass('bg-teal-dark', 'fl-thick');
  });

  it('副（secondary）は薄い色の面で、立体にしない（立体は主ボタンだけ）', () => {
    render(<ThickButton variant="secondary">やめる</ThickButton>);
    const b = screen.getByRole('button', { name: 'やめる' });
    expect(b).toHaveClass('bg-teal-light', 'text-brand');
    expect(b).not.toHaveClass('fl-thick');
  });

  it('文字リンク（link）は厚みも背景も無く、下線つき。タップの高さは 44px 以上', () => {
    render(<ThickButton variant="link">戻る</ThickButton>);
    const b = screen.getByRole('button', { name: '戻る' });
    expect(b).toHaveClass('underline', 'min-h-11');
    expect(b).not.toHaveClass('fl-thick');
    expect(b).not.toHaveClass('w-full');
  });

  it('variant を渡さなければ従来どおり tone で決まる（既存の画面を壊さない）', () => {
    render(<ThickButton tone="coral">削除</ThickButton>);
    expect(screen.getByRole('button', { name: '削除' })).toHaveClass('bg-coral-strong', 'fl-thick');
  });
});

describe('ThickButton アイコン（icon）', () => {
  it('枠なしの 44px の丸で、aria-label で名前が付く', () => {
    render(<ThickButton variant="icon" aria-label="とじる">×</ThickButton>);
    const b = screen.getByRole('button', { name: 'とじる' });
    expect(b).toHaveClass('size-11');
    expect(b).not.toHaveClass('fl-thick');
  });
});
