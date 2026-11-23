import { render, screen } from '@testing-library/react';
import { FORBIDDEN_WORDS } from '@/lib/forbidden-words';
import { PrivacyView, TermsView } from './legal-views';

let search = '';
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(search) }));
beforeEach(() => {
  search = '';
});

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

  it.each([
    ['利用規約', <TermsView key="t" />],
    ['プライバシーの扱い', <PrivacyView key="p" />],
  ])('%s: 設定から開いた（?back=settings）ときは、設定へ戻る（02-9 N2）', (_title, ui) => {
    search = 'back=settings';
    render(ui);
    expect(screen.getByRole('link', { name: '設定へ戻る' })).toHaveAttribute('href', '/settings');
    expect(screen.queryByRole('link', { name: '登録画面へ戻る' })).not.toBeInTheDocument();
  });

  it('知らない戻り先（外の URL など）は受けず、登録画面へ戻す', () => {
    search = 'back=https://evil.example';
    render(<TermsView />);
    expect(screen.getByRole('link', { name: '登録画面へ戻る' })).toHaveAttribute('href', '/signup');
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
