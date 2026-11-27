import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import { Logo } from './logo';

describe('Logo', () => {
  it('印だけのときは img として「FitLog」と読み上げる', () => {
    render(<Logo />);
    expect(screen.getByRole('img', { name: 'FitLog' })).toBeInTheDocument();
  });

  it('名前つきのときは字を出し、印は読み上げから外す（二重に読まない）', () => {
    render(<Logo withName />);
    expect(screen.getByText('FitLog')).toBeInTheDocument();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('size で大きさを変えられる', () => {
    const { container } = render(<Logo size={64} />);
    expect(container.querySelector('svg')).toHaveAttribute('width', '64');
  });

  it('public/logo.svg が存在し、日本語の名前（title）と濃ティールの地を持つ', () => {
    const svg = readFileSync(join(__dirname, '../../public/logo.svg'), 'utf8');
    expect(svg).toContain('<title>FitLog</title>');
    expect(svg).toContain('#0e7f83');
  });
});
