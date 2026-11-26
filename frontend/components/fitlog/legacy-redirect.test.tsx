import { render, screen } from '@testing-library/react';
import { LegacyRedirect } from './legacy-redirect';

const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));

// 古い URL（/today・/me/stats）は新しい場所へ。?day=・?metric= と #japan-trek を引き継ぐ（02-9 ⑫）
describe('LegacyRedirect', () => {
  afterEach(() => {
    replace.mockClear();
    window.history.replaceState(null, '', '/');
  });

  it('転送先へ移す', () => {
    render(<LegacyRedirect to="/log" />);
    expect(replace).toHaveBeenCalledWith('/log');
    expect(screen.getByLabelText('移動中')).toBeInTheDocument();
  });

  it('?day= と #ハッシュ をそのまま引き継ぐ', () => {
    window.history.replaceState(null, '', '/today/?day=yesterday');
    render(<LegacyRedirect to="/log" />);
    expect(replace).toHaveBeenCalledWith('/log?day=yesterday');
    window.history.replaceState(null, '', '/me/stats/?metric=m#japan-trek');
    render(<LegacyRedirect to="/me" />);
    expect(replace).toHaveBeenLastCalledWith('/me?metric=m#japan-trek');
  });
});
