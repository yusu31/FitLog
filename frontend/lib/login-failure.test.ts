import { clearJustSignedIn, loginRedirectPath, markJustSignedIn, readLoginFailed } from './login-failure';

afterEach(() => {
  clearJustSignedIn();
  window.history.replaceState(null, '', '/');
});

describe('ログイン直後にセッションが取れず戻されたときの見分け（L16）', () => {
  it('ログイン直後の印が無ければ、今までどおり戻り先だけをつけてログイン画面へ', () => {
    expect(loginRedirectPath('/today/')).toBe('/login?next=%2Ftoday%2F');
  });

  it('ログイン直後の印があれば、理由つき（failed=1）でログイン画面へ。印は1回で消える', () => {
    markJustSignedIn();
    expect(loginRedirectPath('/today/')).toBe('/login?next=%2Ftoday%2F&failed=1');
    expect(loginRedirectPath('/today/')).toBe('/login?next=%2Ftoday%2F');
  });

  it('?failed=1 のときだけ「失敗して戻ってきた」と読む', () => {
    expect(readLoginFailed()).toBe(false);
    window.history.replaceState(null, '', '/login?next=%2Ftoday&failed=1');
    expect(readLoginFailed()).toBe(true);
  });

  it('印を保存できない環境（sessionStorage が使えない）でも落ちず、印なしとして扱う', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(() => markJustSignedIn()).not.toThrow();
    spy.mockRestore();
    expect(loginRedirectPath('/me/')).toBe('/login?next=%2Fme%2F');
  });
});
