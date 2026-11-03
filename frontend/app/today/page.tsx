import { AppShell } from '@/components/fitlog/app-shell';
import { TodayView } from '@/components/today/today-view';

// S-10 今日（docs/screen-design.md 4章）
export default function TodayPage() {
  return (
    <AppShell syncBanner={false}>
      <TodayView />
    </AppShell>
  );
}
