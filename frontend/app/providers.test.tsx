import { useQueryClient } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { Providers } from './providers';

function Probe() {
  // Providers の外では例外になる（QueryClientProvider が無い）
  const client = useQueryClient();
  return <p>client:{String(client.getDefaultOptions().queries?.staleTime)}</p>;
}

describe('Providers（TanStack Query の入れ物）', () => {
  // T-FE-03: 子の部品から QueryClient が使える。既定の設定が入っている
  it('子の部品が QueryClient を使え、既定の staleTime が入っている', () => {
    render(
      <Providers>
        <Probe />
      </Providers>,
    );
    expect(screen.getByText('client:30000')).toBeInTheDocument();
  });

  // T-FE-04: 子をそのまま描画する
  it('子の部品をそのまま表示する', () => {
    render(
      <Providers>
        <p>子</p>
      </Providers>,
    );
    expect(screen.getByText('子')).toBeInTheDocument();
  });
});
