import { screen } from '@testing-library/react';
import { installFakeApi, renderWithQuery } from '@/lib/test/fake-api';
import { SideFriends } from './side-friends';

afterEach(() => vi.unstubAllGlobals());

function stubMatchMedia(matches: boolean) {
  vi.stubGlobal('matchMedia', () => ({ matches, addEventListener: () => {}, removeEventListener: () => {} }));
}

describe('SideFriends（PC の右の列）', () => {
  it('スマホ幅（lg 未満）では何も出さない', () => {
    installFakeApi({});
    stubMatchMedia(false);
    renderWithQuery(<SideFriends />);
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  });

  it('PC 幅（lg 以上）では「仲間の今日」の列を出す', () => {
    installFakeApi({});
    stubMatchMedia(true);
    renderWithQuery(<SideFriends />);
    expect(screen.getByRole('complementary', { name: '仲間の今日' })).toBeInTheDocument();
  });
});
