import type { Metadata } from 'next';
import { AppShell } from '@/components/fitlog/app-shell';
import { LogView } from '@/components/log/log-view';

export const metadata: Metadata = { title: '記録' };

// S-10 記録（旧「今日」。docs/screen-design.md 4章）。7マス・今日のメニュー・記録の一覧・レポートへの入口
export default function LogPage() {
  return (
    <AppShell syncBanner={false}>
      <LogView />
    </AppShell>
  );
}
