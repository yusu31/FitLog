import { render, screen } from '@testing-library/react';
import { FORBIDDEN_WORDS } from '@/lib/forbidden-words';
import { PrivacyView, TermsView } from './legal-views';

describe('利用規約・プライバシーの扱い（D1 PR-2）', () => {
  it.each([
    ['利用規約', <TermsView key="t" />],
    ['プライバシーの扱い', <PrivacyView key="p" />],
  ])('%s: 見出し（h1）と、登録画面へ戻るリンクがある。ログインは要らない（セッションを呼ばない）', (title, ui) => {
    render(ui);
    expect(screen.getByRole('heading', { level: 1, name: title })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '登録画面へ戻る' })).toHaveAttribute('href', '/signup');
    expect(screen.getAllByRole('heading', { level: 2 }).length).toBeGreaterThanOrEqual(4);
  });

  it('規約には、仲間に見える範囲と、パスワード再設定が無いこと・退会ができることを書く', () => {
    render(<TermsView />);
    const text = document.body.textContent ?? '';
    expect(text).toContain('同じグループの仲間に見えます');
    expect(text).toContain('再設定の機能はありません');
    expect(text).toContain('退会の手続きへ');
  });

  it('プライバシーには、集める情報・目的・見える人・保存先・消し方を書き、分析や第三者への提供はしないと言う', () => {
    render(<PrivacyView />);
    const text = document.body.textContent ?? '';
    for (const word of ['集める情報', '使う目的', 'だれに見えるか', 'どこに保存するか', '消したいとき', '分析のために使うことはありません']) {
      expect(text).toContain(word);
    }
  });

  it('順位・連続日数・禁止語を出さない', () => {
    const { unmount } = render(<TermsView />);
    const a = document.body.textContent ?? '';
    unmount();
    render(<PrivacyView />);
    const b = document.body.textContent ?? '';
    for (const word of ['順位', '連続', ...FORBIDDEN_WORDS]) {
      expect(a).not.toContain(word);
      expect(b).not.toContain(word);
    }
  });
});
