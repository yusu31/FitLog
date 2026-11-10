import { render, screen, within } from '@testing-library/react';
import { CREDIT_PARTS, CREDIT_SOURCE_URL } from '@/lib/credits-data';
import { CreditsView } from './credits-view';

vi.mock('@/lib/use-require-session', () => ({ useRequireSession: () => ({ signedIn: true }) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn() }), usePathname: () => '/settings/credits/' }));

describe('CreditsView（S-34・F-33）', () => {
  it('配布元への外部リンクを、安全な属性つきで出す', () => {
    render(<CreditsView />);
    const link = screen.getByRole('link', { name: /Universal LPC Spritesheet Character Generator/ });
    expect(link).toHaveAttribute('href', CREDIT_SOURCE_URL);
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('使った部品すべての作者とライセンスを出す', () => {
    render(<CreditsView />);
    const list = screen.getByRole('list');
    expect(within(list).getAllByRole('listitem')).toHaveLength(CREDIT_PARTS.length);
    expect(CREDIT_PARTS.length).toBeGreaterThan(0);
    for (const p of CREDIT_PARTS) {
      expect(p.authors, p.part).not.toBe('');
      expect(p.license, p.part).toMatch(/OGA-BY|CC-BY|CC0/);
    }
  });

  it('CC-BY-SA・GPL（派生物に同じ条件が及ぶもの）は含まれない', () => {
    expect(CREDIT_PARTS.map((p) => p.license).join(' ')).not.toMatch(/SA|GPL/);
  });

  it('加工した旨を載せる（ライセンスが求める）', () => {
    render(<CreditsView />);
    expect(screen.getByText(/塗り替え/)).toBeInTheDocument();
  });
});
