import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PREFS_KEY, readPrefs } from '@/lib/preferences';
import { PreferencesSection } from './preferences-section';

afterEach(() => localStorage.removeItem(PREFS_KEY));

describe('PreferencesSection（設定の端末ごとの項目）', () => {
  it('通知の種類を切り替えると、端末に保存される', async () => {
    const user = userEvent.setup();
    render(<PreferencesSection />);
    const sw = screen.getByRole('switch', { name: 'スタンプをもらったとき' });
    expect(sw).toHaveAttribute('aria-checked', 'true');
    await user.click(sw);
    expect(sw).toHaveAttribute('aria-checked', 'false');
    expect(readPrefs().notify.stamp).toBe(false);
  });

  it('動画の自動再生は、はじめオフ。オンにできる', async () => {
    const user = userEvent.setup();
    render(<PreferencesSection />);
    const sw = screen.getByRole('switch', { name: '動画を自動で再生する' });
    expect(sw).toHaveAttribute('aria-checked', 'false');
    await user.click(sw);
    expect(readPrefs().autoplayVideo).toBe(true);
  });

  it('誘う時刻は19時から始まり、選べる。誘いをオフにすると選べない', async () => {
    const user = userEvent.setup();
    render(<PreferencesSection />);
    const select = screen.getByLabelText('誘う時刻');
    expect(select).toHaveValue('19');
    await user.selectOptions(select, '8');
    expect(readPrefs().reminderHour).toBe(8);
    await user.click(screen.getByRole('switch', { name: '記録していない日に誘う' }));
    expect(select).toBeDisabled();
  });

  it('規約・プライバシーへのリンクと版を出す', () => {
    render(<PreferencesSection />);
    expect(screen.getByRole('link', { name: '利用規約' })).toHaveAttribute('href', '/terms');
    expect(screen.getByRole('link', { name: 'プライバシー' })).toHaveAttribute('href', '/privacy');
    expect(screen.getByText('版')).toBeInTheDocument();
  });
});
