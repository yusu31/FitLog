import { render, screen, within } from '@testing-library/react';
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
    const group = screen.getByRole('radiogroup', { name: '誘う時刻' });
    expect(within(group).getByRole('radio', { name: '19時' })).toHaveAttribute('aria-checked', 'true');
    await user.click(within(group).getByRole('radio', { name: '8時' }));
    expect(readPrefs().reminderHour).toBe(8);
    await user.click(screen.getByRole('switch', { name: '記録していない日に誘う' }));
    expect(within(group).getByRole('radio', { name: '8時' })).toBeDisabled();
  });

  it('規約・プライバシーへのリンクと版を出す', () => {
    render(<PreferencesSection />);
    expect(screen.getByRole('link', { name: '利用規約' })).toHaveAttribute('href', '/terms?back=settings');
    expect(screen.getByRole('link', { name: 'プライバシー' })).toHaveAttribute('href', '/privacy?back=settings');
    expect(screen.getByText('版')).toBeInTheDocument();
  });
});

describe('PreferencesSection（表示: 最初のタブ・単位。D6-5）', () => {
  it('最初に開くタブは「ホーム」から始まり、「仲間」に変えると端末に保存される', async () => {
    const user = userEvent.setup();
    render(<PreferencesSection />);
    const group = screen.getByRole('radiogroup', { name: '最初に開くタブ' });
    expect(within(group).getByRole('radio', { name: 'ホーム' })).toHaveAttribute('aria-checked', 'true');
    await user.click(within(group).getByRole('radio', { name: '仲間' }));
    expect(within(group).getByRole('radio', { name: '仲間' })).toHaveAttribute('aria-checked', 'true');
    expect(readPrefs().firstTab).toBe('friends');
  });

  it('重さの単位は kg から始まり、lb に変えると端末に保存される（ほかの設定は消えない）', async () => {
    const user = userEvent.setup();
    render(<PreferencesSection />);
    await user.click(screen.getByRole('switch', { name: '動画を自動で再生する' }));
    const group = screen.getByRole('radiogroup', { name: '重さの単位' });
    expect(within(group).getByRole('radio', { name: 'kg' })).toHaveAttribute('aria-checked', 'true');
    await user.click(within(group).getByRole('radio', { name: 'lb' }));
    expect(readPrefs().unit).toBe('lb');
    expect(readPrefs().autoplayVideo).toBe(true);
  });
});
