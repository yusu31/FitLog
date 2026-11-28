import { render, screen, waitFor } from '@testing-library/react';
import { LoginBackdrop } from '@/components/auth/login-backdrop';
import { LOGIN_BG_KEY } from '@/lib/login-backgrounds';

const BGS = [{ src: '/login-bg/a.webp' }, { src: '/login-bg/b.webp', position: 'top' }];

// 読み込みの成功・失敗をテストから決められる Image の代役（jsdom は画像を読まない）
function stubImage(result: 'load' | 'error') {
  class FakeImage {
    onload: (() => void) | null = null;
    set src(_v: string) {
      if (result === 'load') queueMicrotask(() => this.onload?.());
    }
  }
  vi.stubGlobal('Image', FakeImage);
}

describe('LoginBackdrop（背景の差し替え・Issue #473）', () => {
  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
    window.history.replaceState(null, '', '/');
  });

  it('?bg=1 で2枚目に固定され、読めたら出る。番号を覚える', async () => {
    stubImage('load');
    window.history.replaceState(null, '', '/login?bg=1');
    render(<LoginBackdrop backgrounds={BGS} />);
    await waitFor(() => expect(screen.getByTestId('login-backdrop')).toHaveAttribute('data-shown', '/login-bg/b.webp'));
    expect(localStorage.getItem(LOGIN_BG_KEY)).toBe('1');
  });

  it('画像が読めないときは何も出さない（今までの帯のまま）', async () => {
    stubImage('error');
    window.history.replaceState(null, '', '/login?bg=0');
    render(<LoginBackdrop backgrounds={BGS} />);
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.getByTestId('login-backdrop')).toHaveAttribute('data-shown', '');
  });

  it('絵の配列が空なら何もしない', () => {
    render(<LoginBackdrop backgrounds={[]} />);
    expect(screen.getByTestId('login-backdrop')).toHaveAttribute('data-shown', '');
    expect(localStorage.getItem(LOGIN_BG_KEY)).toBeNull();
  });
});
