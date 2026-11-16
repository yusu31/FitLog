import type { Metadata } from 'next';
import { AppShell } from '@/components/fitlog/app-shell';
import { TodayView } from '@/components/today/today-view';

export const metadata: Metadata = { title: '今日' };

// S-10 今日（docs/screen-design.md 4章）
export default function TodayPage() {
  return (
    <AppShell syncBanner={false}>
      <TodayView />
    </AppShell>
  );
}
